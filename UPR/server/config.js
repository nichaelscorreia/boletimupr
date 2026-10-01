require('dotenv').config();

// Aceita o identificador da API ("claude-sonnet-5-5") ou o nome usual ("Sonnet 5.5", "opus 5.5")
function modeloAssistente(valor) {
  const v = String(valor || '').trim();
  if (!v) return 'claude-opus-5-5';
  if (v.toLowerCase().startsWith('claude-')) return v.toLowerCase();
  const nome = v.toLowerCase().replace(/claude/g, '').replace(/[\s._-]+/g, ' ').trim();
  const apelidos = { 'sonnet 5 5': 'claude-sonnet-5-5', 'sonnet': 'claude-sonnet-5-5', 'opus 5 5': 'claude-opus-5-5', 'opus': 'claude-opus-5-5' };
  return apelidos[nome] || v;
}

module.exports = {
  port: process.env.PORT || 3000,
  safra: process.env.ORACLE_SAFRA || '54',
  // Data de início da safra (dd/mm/aaaa). Vazio = padrão configurado no Tomcat.
  inicioSafra: process.env.SAFRA_INICIO || '',
  api: {
    baseUrl: process.env.BOLETIM_API_URL || 'http://nstech.ddns.net:8086/boletim-api',
    secret: process.env.BOLETIM_API_SECRET || '',
    timeoutMs: parseInt(process.env.BOLETIM_API_TIMEOUT_MS, 10) || 150000
  },
  acesso: {
    // "off" desliga o controle de acesso por dispositivo (ex.: desenvolvimento local sem Tomcat)
    ativo: process.env.CONTROLE_ACESSO !== 'off',
    // Código que libera o dispositivo na hora, já como administrador (use para o seu primeiro acesso).
    // Vazio = desativado; aí a liberação inicial é feita por SQL (ver tomcat-api/ddl).
    codigoLiberacao: process.env.ACESSO_CODIGO_LIBERACAO || ''
  },
  assistente: {
    // Chave da API do Claude (Anthropic). Vazio = assistente desativado (o botão não aparece)
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    modelo: modeloAssistente(process.env.ASSISTENTE_MODELO),
    esforco: process.env.ASSISTENTE_ESFORCO || 'medium', // low | medium | high
    limiteHora: parseInt(process.env.ASSISTENTE_LIMITE_HORA, 10) || 30,   // perguntas por dispositivo por hora
    limiteDia: parseInt(process.env.ASSISTENTE_LIMITE_DIA, 10) || 500     // perguntas no total por dia
  },
  mockMode: process.env.FORCE_MOCK === 'true'
};
