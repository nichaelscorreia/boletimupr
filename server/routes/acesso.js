// Rotas do controle de acesso por dispositivo (/api/acesso)
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const config = require('../config');
const oracle = require('../db/oracle');
const queries = require('../db/queries');
const acesso = require('../services/acessoDispositivo');

const SITUACAO = { P: 'pendente', A: 'aprovado', B: 'bloqueado' };

// Ações que alteram dados só aceitam JSON vindo da própria origem (proteção contra CSRF,
// somada ao cookie SameSite=Lax)
router.use((req, res, next) => {
  if (req.method === 'GET') return next();
  const origin = req.get('origin');
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch (e) { /* origem inválida */ }
    if (host !== req.get('host')) return res.status(403).json({ error: 'Origem não permitida' });
  }
  if (!req.is('application/json')) return res.status(415).json({ error: 'Envie JSON' });
  next();
});

// Limite de pedidos de acesso por IP (evita encher a tabela de pendentes)
const tentativas = new Map();
function limitarPorIp(req, res, next) {
  const agora = Date.now();
  const t = tentativas.get(req.ip);
  if (!t || agora - t.inicio > 60 * 60 * 1000) {
    if (tentativas.size > 10000) tentativas.clear();
    tentativas.set(req.ip, { inicio: agora, n: 1 });
    return next();
  }
  if (++t.n > 10) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
  next();
}

function texto(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function codigoConfere(codigo) {
  const esperado = config.acesso.codigoLiberacao;
  if (!esperado || !codigo) return false;
  const a = crypto.createHash('sha256').update(String(codigo)).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}

// GET /api/acesso/status — situação deste dispositivo (a tela inicial decide o que mostrar)
router.get('/status', async (req, res) => {
  if (!config.acesso.ativo) return res.json({ status: 'aprovado', controleAtivo: false });

  const base = { controleAtivo: true, codigoDisponivel: !!config.acesso.codigoLiberacao };
  const token = acesso.lerToken(req);
  if (!token) return res.json({ ...base, status: 'nao_identificado' });

  try {
    const d = await acesso.consultar(acesso.hashToken(token), { forcar: true });
    if (!d) return res.json({ ...base, status: 'nao_identificado' });
    // Renova a validade do cookie a cada abertura do sistema
    acesso.gravarCookie(req, res, token);
    res.json({ ...base, status: SITUACAO[d.status] || 'bloqueado', nome: d.nome, descricao: d.descricao, admin: d.admin });
  } catch (err) {
    console.error(`Erro ao consultar situação do dispositivo: ${err.message}`);
    res.status(503).json({ ...base, status: 'indisponivel' });
  }
});

// POST /api/acesso/solicitar — identificação no primeiro acesso
router.post('/solicitar', limitarPorIp, async (req, res) => {
  if (!config.acesso.ativo) return res.json({ status: 'aprovado' });

  const nome = texto(req.body.nome, 100);
  const descricao = texto(req.body.descricao, 100);
  const setor = texto(req.body.setor, 100);
  const contato = texto(req.body.contato, 100);
  const codigo = texto(req.body.codigo, 200);
  if (nome.length < 3 || descricao.length < 2) {
    return res.status(400).json({ error: 'Informe seu nome e uma identificação para este dispositivo.' });
  }

  let token = acesso.lerToken(req);
  try {
    if (token) {
      const atual = await acesso.consultar(acesso.hashToken(token), { forcar: true });
      if (atual && atual.status !== 'P') {
        return res.status(409).json({ status: SITUACAO[atual.status], error: 'Este dispositivo já foi analisado.' });
      }
    } else {
      token = acesso.novoToken();
    }
    const hash = acesso.hashToken(token);

    await oracle.executeCommand(queries.acesso.solicitar({
      hash, nome, descricao,
      setor: setor || undefined,
      contato: contato || undefined,
      userAgent: texto(req.get('user-agent'), 400) || undefined,
      ip: acesso.ipValido(req.ip)
    }));
    acesso.gravarCookie(req, res, token);

    let status = 'pendente';
    let codigoInvalido = false;
    if (codigo) {
      if (codigoConfere(codigo)) {
        await oracle.executeCommand(queries.acesso.liberarComCodigo(hash));
        status = 'aprovado';
        console.log(`🔑 Dispositivo "${descricao}" de ${nome} liberado com o código de liberação`);
      } else {
        codigoInvalido = true;
      }
    }
    acesso.invalidar(hash);
    res.json({ status, codigoInvalido });
  } catch (err) {
    console.error(`Erro ao registrar pedido de acesso: ${err.message}`);
    res.status(503).json({ error: 'Não foi possível registrar o pedido agora. Tente novamente em instantes.' });
  }
});

// --- Administração (somente dispositivos aprovados e marcados como administrador) ---
router.use('/dispositivos', acesso.exigirDispositivoAprovado, acesso.exigirAdmin);

router.get('/dispositivos', async (req, res) => {
  try {
    const rows = await oracle.executeQueryStrict(queries.acesso.listar());
    res.json({
      dispositivos: rows.map(r => ({
        id: parseInt(r.ID, 10),
        nome: r.NOME,
        setor: r.SETOR,
        contato: r.CONTATO,
        descricao: r.DESCRICAO,
        userAgent: r.USER_AGENT,
        ipCadastro: r.IP_CADASTRO,
        status: SITUACAO[r.STATUS] || r.STATUS,
        admin: r.ADMIN === 'S',
        dataCadastro: r.DATA_CADASTRO,
        dataAlteracaoStatus: r.DATA_ALTERACAO_STATUS,
        alteradoPor: r.ALTERADO_POR,
        ultimoAcesso: r.ULTIMO_ACESSO,
        ipUltimoAcesso: r.IP_ULTIMO_ACESSO,
        atual: parseInt(r.ID, 10) === req.dispositivo.id
      }))
    });
  } catch (err) {
    console.error(`Erro ao listar dispositivos: ${err.message}`);
    res.status(503).json({ error: 'Não foi possível carregar os dispositivos.' });
  }
});

function idDoParametro(req, res) {
  const id = /^\d{1,9}$/.test(req.params.id) ? parseInt(req.params.id, 10) : null;
  if (!id) {
    res.status(400).json({ error: 'ID inválido' });
    return null;
  }
  // Impede o administrador de bloquear/excluir/rebaixar o próprio dispositivo e ficar sem acesso
  if (id === req.dispositivo.id) {
    res.status(400).json({ error: 'Você não pode alterar o seu próprio dispositivo.' });
    return null;
  }
  return id;
}

const autor = (req) => `${req.dispositivo.nome} (${req.dispositivo.descricao})`.slice(0, 100);

async function executarAcao(res, comando) {
  try {
    const r = await oracle.executeCommand(comando);
    acesso.invalidar(); // o cache é por hash; limpa tudo para a mudança valer na hora
    if (!r || !r.linhas) return res.status(404).json({ error: 'Dispositivo não encontrado ou não aprovado.' });
    res.json({ success: true });
  } catch (err) {
    console.error(`Erro na administração de dispositivos: ${err.message}`);
    res.status(503).json({ error: 'Não foi possível concluir a ação.' });
  }
}

router.post('/dispositivos/:id/aprovar', (req, res) => {
  const id = idDoParametro(req, res);
  if (id) executarAcao(res, queries.acesso.alterarStatus(id, 'A', autor(req)));
});

router.post('/dispositivos/:id/bloquear', (req, res) => {
  const id = idDoParametro(req, res);
  if (id) executarAcao(res, queries.acesso.alterarStatus(id, 'B', autor(req)));
});

router.post('/dispositivos/:id/admin', (req, res) => {
  const id = idDoParametro(req, res);
  if (id) executarAcao(res, queries.acesso.definirAdmin(id, req.body.admin === true ? 'S' : 'N', autor(req)));
});

router.delete('/dispositivos/:id', (req, res) => {
  const id = idDoParametro(req, res);
  if (id) executarAcao(res, queries.acesso.excluir(id));
});

module.exports = router;
