require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  safra: process.env.ORACLE_SAFRA || '54',
  // Data de início da safra (dd/mm/aaaa). Vazio = padrão configurado no Tomcat.
  inicioSafra: process.env.SAFRA_INICIO || '',
  api: {
    // Sem padrão: cada usina tem a sua Boletim API (nunca cair na da UPR por engano)
    baseUrl: process.env.BOLETIM_API_URL || '',
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
  mockMode: process.env.FORCE_MOCK === 'true'
};
