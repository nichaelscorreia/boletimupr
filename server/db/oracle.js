// Acesso aos dados Oracle via Boletim API (Tomcat na rede da usina).
// Mantém a mesma interface do antigo OracleBridge (initOraclePool / executeQuery / isOracleConnected),
// mas em vez de SQL recebe um descritor { name, params } vindo de queries.js.
const crypto = require('crypto');
const config = require('../config');

let isConnected = false;
let retryTimer = null;

function buildUrl(path, params = {}) {
  const url = new URL(config.api.baseUrl.replace(/\/+$/, '') + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

// Assinatura HMAC-SHA256: o segredo nunca trafega, só a assinatura (válida por poucos minutos)
async function apiGet(path, params) {
  const url = buildUrl(path, params);
  const timestamp = String(Date.now());
  const signature = crypto
    .createHmac('sha256', config.api.secret)
    .update(`${timestamp}\nGET\n${url.pathname}${url.search}`)
    .digest('hex');

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'X-Boletim-Timestamp': timestamp,
      'X-Boletim-Signature': signature
    },
    signal: AbortSignal.timeout(config.api.timeoutMs)
  });

  let body = null;
  try {
    body = await res.json();
  } catch (e) {
    // corpo não-JSON (ex.: página de erro do Tomcat)
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}${body && body.error ? ` - ${body.error}` : ''}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function isApiAlive() {
  try {
    const body = await apiGet('/api/ping');
    return !!(body && body.status === 'ok');
  } catch (err) {
    console.warn(`⚠️ Boletim API indisponível: ${err.message}`);
    return false;
  }
}

// Enquanto desconectado, tenta de novo a cada 30s (as rotas usam isOracleConnected() para decidir mock x real)
function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setInterval(async () => {
    if (isConnected) return;
    if (await isApiAlive()) {
      isConnected = true;
      console.log('✅ Boletim API reconectada!');
    }
  }, 30000);
  retryTimer.unref();
}

async function initOraclePool() {
  if (config.mockMode) {
    console.log('ℹ️ FORCE_MOCK ativado nas configurações.');
    isConnected = false;
    return false;
  }
  if (!config.api.secret) {
    console.warn('⚠️ BOLETIM_API_SECRET não definido: usando dados simulados.');
    isConnected = false;
    return false;
  }

  isConnected = await isApiAlive();
  console.log(isConnected
    ? `✅ Conectado ao Oracle via Boletim API (${config.api.baseUrl})`
    : '⚠️ Boletim API fora do ar; usando dados simulados até reconectar.');
  scheduleRetry();
  return isConnected;
}

async function executeQuery(query) {
  if (!query || !query.name) {
    console.error('executeQuery: descritor de consulta inválido', query);
    return null;
  }
  try {
    const data = await apiGet(`/api/q/${query.name}`, query.params);
    isConnected = true;
    return Array.isArray(data) ? data : null;
  } catch (err) {
    console.error(`Erro na consulta ${query.name}: ${err.message}`);
    // Falha de rede/autenticação/serviço derruba o status; erro de SQL (500) ou parâmetro (400) não
    if (!err.status || err.status === 401 || err.status === 403 || err.status === 503) {
      isConnected = false;
    }
    return null;
  }
}

function isOracleConnected() {
  return isConnected;
}

module.exports = {
  initOraclePool,
  executeQuery,
  isOracleConnected
};
