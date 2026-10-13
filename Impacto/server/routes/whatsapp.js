// Administração do envio de relatórios dos fretistas pelo WhatsApp (/api/whatsapp) — somente administradores.
// Tudo é executado pela Boletim API no Tomcat (cadastros no Oracle, PDF e chamadas à Evolution API);
// aqui só se valida quem pede e se repassa a chamada assinada.
const express = require('express');
const router = express.Router();
const config = require('../config');
const oracle = require('../db/oracle');

// Administrador = dispositivo marcado como admin (com o controle de acesso desligado, qualquer um: uso local)
router.use((req, res, next) => {
  if (config.acesso.ativo && !(req.dispositivo && req.dispositivo.admin)) {
    return res.status(403).json({ error: 'Somente um administrador pode gerenciar o WhatsApp.' });
  }
  if (req.method === 'GET') return next();
  // Ações que alteram dados só aceitam JSON vindo da própria origem (proteção contra CSRF)
  const origin = req.get('origin');
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch (e) { /* origem inválida */ }
    if (host !== req.get('host')) return res.status(403).json({ error: 'Origem não permitida' });
  }
  if (!req.is('application/json')) return res.status(415).json({ error: 'Envie JSON' });
  next();
});

const autor = (req) => (req.dispositivo ? `${req.dispositivo.nome} (${req.dispositivo.descricao})`.slice(0, 100) : 'administrador local');
const inteiro = (v) => (/^\d{1,9}$/.test(String(v)) ? parseInt(v, 10) : null);

// Repassa a chamada ao Tomcat; erros de validação (400) voltam com a mensagem original
async function repassar(res, metodo, caminho, params) {
  try {
    res.json(await oracle.apiRequest(metodo, `/api/whatsapp/${caminho}`, params));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.apiError || 'Dados inválidos.' });
    console.error(`WhatsApp (${caminho}): ${err.message}`);
    res.status(err.status === 404 ? 501 : 503).json({
      error: err.status === 404
        ? 'A Boletim API do servidor ainda não tem o módulo de WhatsApp (atualize o WAR).'
        : `Não foi possível concluir agora.${err.apiError ? ` ${err.apiError}` : ''}`
    });
  }
}

// Só confirma que este dispositivo pode administrar (o botão do painel aparece com base nisso)
router.get('/permissao', (req, res) => res.json({ admin: true }));

router.get('/', (req, res) => repassar(res, 'GET', 'estado'));
router.get('/fornecedores', (req, res) => repassar(res, 'GET', 'fornecedores'));

router.post('/cadastro', (req, res) => {
  const fornecedor = inteiro(req.body.codFornecedor);
  const numero = String(req.body.numero || '').replace(/\D/g, '');
  if (!fornecedor) return res.status(400).json({ error: 'Informe o código do fornecedor.' });
  if (numero.length < 10 || numero.length > 13) return res.status(400).json({ error: 'Informe o WhatsApp com DDD (ex.: 82 99114-2153).' });
  repassar(res, 'POST', 'cadastro', {
    id: inteiro(req.body.id) || undefined, fornecedor, numero, ativo: req.body.ativo === false ? 'N' : 'S', por: autor(req)
  });
});

router.post('/excluir', (req, res) => {
  const id = inteiro(req.body.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  repassar(res, 'POST', 'excluir', { id });
});

router.post('/config', (req, res) => {
  const hora = String(req.body.hora || '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return res.status(400).json({ error: 'Horário inválido (use HH:mm).' });
  repassar(res, 'POST', 'config', { ativo: req.body.ativo === true ? 'S' : 'N', hora, por: autor(req) });
});

router.post('/enviar', (req, res) => {
  const id = inteiro(req.body.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  const data = /^\d{2}\/\d{2}\/\d{4}$/.test(req.body.data || '') ? req.body.data : undefined;
  repassar(res, 'POST', 'enviar', { id, data });
});

router.post('/webhook', (req, res) => repassar(res, 'POST', 'webhook-configurar'));

module.exports = router;
