// Rotas do assistente de dados (/api/assistente) — só para dispositivos liberados (middleware em index.js)
const express = require('express');
const router = express.Router();
const config = require('../config');
const assistente = require('../services/assistente');
const painelConfig = require('../services/painelConfig');

const CHAVE_ATIVO = 'assistente.ativo'; // 'S' (padrão) ou 'N', gravado pelo administrador

// Quem pergunta: o dispositivo liberado (ou o IP, com o controle de acesso desligado)
const dono = (req) => (req.dispositivo ? `d${req.dispositivo.id}` : `ip${req.ip}`);
// Administrador = dispositivo marcado como admin (com o controle de acesso desligado, qualquer um: uso local)
const ehAdmin = (req) => (config.acesso.ativo ? !!(req.dispositivo && req.dispositivo.admin) : true);
const habilitado = async () => (await painelConfig.obter(CHAVE_ATIVO, 'S')) !== 'N';

// configurado = há chave da API do Claude no servidor; habilitado = ligado pelo administrador
router.get('/status', async (req, res) => {
  const configurado = assistente.ativo();
  const ligado = configurado && await habilitado();
  res.json({ ativo: ligado, configurado, habilitado: ligado, podeAlterar: configurado && ehAdmin(req) });
});

router.post('/habilitar', async (req, res) => {
  if (!ehAdmin(req)) return res.status(403).json({ error: 'Somente um administrador pode ligar ou desligar o assistente.' });
  if (typeof req.body.habilitado !== 'boolean') return res.status(400).json({ error: 'Informe habilitado: true ou false.' });
  const por = req.dispositivo ? `${req.dispositivo.nome} (${req.dispositivo.descricao})`.slice(0, 100) : 'administrador local';
  try {
    await painelConfig.definir(CHAVE_ATIVO, req.body.habilitado ? 'S' : 'N', por);
    console.log(`🤖 Assistente ${req.body.habilitado ? 'LIGADO' : 'DESLIGADO'} por ${por}`);
    res.json({ success: true, habilitado: req.body.habilitado });
  } catch (err) {
    console.error(`Assistente: não foi possível gravar a configuração: ${err.message}`);
    res.status(503).json({ error: 'Não foi possível gravar a configuração agora.' });
  }
});

router.post('/perguntar', async (req, res) => {
  if (!assistente.ativo()) return res.status(503).json({ error: 'Assistente não configurado.' });
  if (!(await habilitado())) return res.status(403).json({ error: 'O assistente está desativado pelo administrador.', desativado: true });
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
