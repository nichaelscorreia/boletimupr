// Controle de acesso por dispositivo.
//
// Cada navegador recebe um identificador aleatório de 256 bits num cookie httpOnly (o JavaScript da página
// não consegue lê-lo). No Oracle (NST_DISPOSITIVO_ACESSO) fica só o SHA-256 dele; quem tiver acesso à tabela
// não consegue se passar por um dispositivo liberado. A situação do dispositivo é consultada na Boletim API
// e mantida em cache curto para não ir ao Oracle a cada requisição.
const crypto = require('crypto');
const config = require('../config');
const oracle = require('../db/oracle');
const queries = require('../db/queries');

const COOKIE = 'bom_dispositivo';
const COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000; // limite máximo aceito pelos navegadores
const CACHE_FRESCO_MS = 60 * 1000;
// Se a API cair, dispositivo já aprovado continua entrando por até 12h com a última situação conhecida
const CACHE_APROVADO_SEM_API_MS = 12 * 60 * 60 * 1000;
const REGISTRO_USO_MS = 30 * 60 * 1000;

const cache = new Map();       // hash -> { dispositivo, em }
const ultimoUso = new Map();   // hash -> timestamp do último registro de uso

function lerToken(req) {
  const header = req.headers.cookie || '';
  for (const parte of header.split(';')) {
    const [nome, ...resto] = parte.trim().split('=');
    if (nome === COOKIE) {
      const valor = decodeURIComponent(resto.join('='));
      return /^[A-Za-z0-9_-]{43}$/.test(valor) ? valor : null;
    }
  }
  return null;
}

const novoToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function gravarCookie(req, res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: req.secure,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/'
  });
}

function mapear(row) {
  return row && {
    id: parseInt(row.ID, 10),
    nome: row.NOME,
    descricao: row.DESCRICAO,
    status: row.STATUS,
    admin: row.ADMIN === 'S'
  };
}

// Situação do dispositivo (null = não cadastrado). Lança erro se a API estiver fora e não houver cache útil.
async function consultar(hash, { forcar = false } = {}) {
  const c = cache.get(hash);
  const agora = Date.now();
  if (c && !forcar && agora - c.em < CACHE_FRESCO_MS) return c.dispositivo;
  try {
    const rows = await oracle.executeQueryStrict(queries.acesso.dispositivo(hash));
    const dispositivo = mapear(rows[0]) || null;
    if (cache.size > 5000) cache.clear();
    cache.set(hash, { dispositivo, em: agora });
    return dispositivo;
  } catch (err) {
    if (c && c.dispositivo && c.dispositivo.status === 'A' && agora - c.em < CACHE_APROVADO_SEM_API_MS) {
      return c.dispositivo;
    }
    throw err;
  }
}

function invalidar(hash) {
  if (hash) cache.delete(hash);
  else cache.clear();
}

function registrarUso(hash, ip) {
  const agora = Date.now();
  if (agora - (ultimoUso.get(hash) || 0) < REGISTRO_USO_MS) return;
  ultimoUso.set(hash, agora);
  oracle.executeCommand(queries.acesso.registrarUso(hash, ipValido(ip)))
    .catch(err => console.warn(`Falha ao registrar uso do dispositivo: ${err.message}`));
}

function ipValido(ip) {
  const limpo = String(ip || '').replace(/^::ffff:/, '');
  return /^[0-9A-Fa-f:.]{1,45}$/.test(limpo) ? limpo : undefined;
}

// Middleware: só deixa passar dispositivos aprovados. Responde com { acesso: <situação> } para o frontend
// saber qual tela mostrar.
async function exigirDispositivoAprovado(req, res, next) {
  if (!config.acesso.ativo) return next();

  const token = lerToken(req);
  if (!token) return res.status(401).json({ acesso: 'nao_identificado' });

  const hash = hashToken(token);
  let dispositivo;
  try {
    dispositivo = await consultar(hash);
  } catch (err) {
    console.error(`Controle de acesso indisponível: ${err.message}`);
    return res.status(503).json({ acesso: 'indisponivel' });
  }

  if (!dispositivo) return res.status(401).json({ acesso: 'nao_identificado' });
  if (dispositivo.status === 'P') return res.status(403).json({ acesso: 'pendente' });
  if (dispositivo.status !== 'A') return res.status(403).json({ acesso: 'bloqueado' });

  req.dispositivo = dispositivo;
  registrarUso(hash, req.ip);
  next();
}

function exigirAdmin(req, res, next) {
  if (!config.acesso.ativo) return res.status(404).json({ error: 'Controle de acesso desativado' });
  if (!req.dispositivo || !req.dispositivo.admin) return res.status(403).json({ acesso: 'sem_permissao' });
  next();
}

module.exports = {
  lerToken,
  novoToken,
  hashToken,
  gravarCookie,
  consultar,
  invalidar,
  ipValido,
  exigirDispositivoAprovado,
  exigirAdmin
};
