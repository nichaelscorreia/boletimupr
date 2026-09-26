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
  mockMode: process.env.FORCE_MOCK === 'true'
};
