// Rotas do assistente de dados (/api/assistente) — só para dispositivos liberados (middleware em index.js)
const express = require('express');
const router = express.Router();
const assistente = require('../services/assistente');

// Quem pergunta: o dispositivo liberado (ou o IP, com o controle de acesso desligado)
const dono = (req) => (req.dispositivo ? `d${req.dispositivo.id}` : `ip${req.ip}`);

router.get('/status', (req, res) => {
  res.json({ ativo: assistente.ativo() });
});

router.post('/perguntar', async (req, res) => {
  if (!assistente.ativo()) return res.status(503).json({ error: 'Assistente não configurado.' });
  const pergunta = typeof req.body.pergunta === 'string' ? req.body.pergunta.replace(/\s+/g, ' ').trim() : '';
  if (pergunta.length < 2) return res.status(400).json({ error: 'Faça uma pergunta.' });
  if (pergunta.length > 1000) return res.status(400).json({ error: 'Pergunta longa demais (máximo 1.000 caracteres).' });
  const conversaId = typeof req.body.conversaId === 'string' ? req.body.conversaId : null;

  const r = await assistente.perguntar({ pergunta, conversaId, dono: dono(req) });
  if (r.erro) return res.status(r.status || 500).json({ error: r.erro });
  res.json({ conversaId: r.conversaId, resposta: r.resposta, consultas: [...new Set(r.consultas)] });
});

router.post('/nova', (req, res) => {
  if (typeof req.body.conversaId === 'string') assistente.encerrarConversa(req.body.conversaId, dono(req));
  res.json({ success: true });
});

module.exports = router;
