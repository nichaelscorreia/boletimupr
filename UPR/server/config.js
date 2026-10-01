require('dotenv').config();

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
    modelo: process.env.ASSISTENTE_MODELO || 'claude-opus-5-5',
    esforco: process.env.ASSISTENTE_ESFORCO || 'medium', // low | medium | high
    limiteHora: parseInt(process.env.ASSISTENTE_LIMITE_HORA, 10) || 30,   // perguntas por dispositivo por hora
    limiteDia: parseInt(process.env.ASSISTENTE_LIMITE_DIA, 10) || 500     // perguntas no total por dia
  },
  mockMode: process.env.FORCE_MOCK === 'true'
};
