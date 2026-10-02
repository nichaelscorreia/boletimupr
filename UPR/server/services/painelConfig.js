// Configurações do painel gravadas no Oracle (NST_PAINEL_CONFIG), alteráveis pelo administrador dentro do sistema.
// Ficam no banco (e não na memória) para sobreviverem aos reinícios do app.
const oracle = require('../db/oracle');
const queries = require('../db/queries');

const CACHE_MS = 30 * 1000;
const cache = new Map(); // chave -> { valor, em }

// Valor da configuração; se o banco não responder, usa o último valor conhecido (ou o padrão)
async function obter(chave, padrao) {
  const c = cache.get(chave);
  if (c && Date.now() - c.em < CACHE_MS) return c.valor;
  try {
    const rows = await oracle.executeQueryStrict(queries.config.obter(chave));
    const valor = rows[0] && rows[0].VALOR !== null ? rows[0].VALOR : padrao;
    cache.set(chave, { valor, em: Date.now() });
    return valor;
  } catch (err) {
    return c ? c.valor : padrao;
  }
}

async function definir(chave, valor, por) {
  await oracle.executeCommand(queries.config.definir(chave, valor, por));
  cache.set(chave, { valor, em: Date.now() });
}

module.exports = { obter, definir };
