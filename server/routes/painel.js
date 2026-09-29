// GET /api/painel/ticker — dados da faixa superior do modo TV
const express = require('express');
const router = express.Router();
const oracle = require('../db/oracle');
const queries = require('../db/queries');
const config = require('../config');
const { montarMoendas } = require('../services/moendas');

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? null : n;
};

// Toneladas do período ("Hoje", "Safra"...) na linha de total (TIPO 0) do resumo
function tonPeriodo(rows, periodo) {
  const r = (rows || []).find(x => x.TIPO === '0' && (x.PERIODO || '').trim().toLowerCase() === periodo);
  return r ? num(r.PESLIQ) || 0 : 0;
}

// % mecanizado = colhedora ÷ (colhedora + manual) do período, a mesma base da coluna "% do Total" dos resumos
function pctMecanizada(colhedora, manual, periodo) {
  const c = tonPeriodo(colhedora, periodo);
  const base = c + tonPeriodo(manual, periodo);
  return base > 0 ? Number(((c / base) * 100).toFixed(1)) : null;
}

// Várias TVs/navegadores consultam a faixa a cada minuto: uma resposta vale por 30s para todos
const CACHE_MS = 30 * 1000;
let cache = { em: 0, dados: null };

router.get('/ticker', async (req, res) => {
  if (cache.dados && Date.now() - cache.em < CACHE_MS) return res.json(cache.dados);

  const [statusRows, moagemRows, colhedoraRows, manualRows] = await Promise.all([
    oracle.executeQuery(queries.industria.statusFabrica),
    oracle.executeQuery(queries.laboratorio.moagemMedia(config.safra)),
    oracle.executeQuery(queries.agricola.resumoColhedora(config.safra)),
    oracle.executeQuery(queries.agricola.resumoManual(config.safra))
  ]);

  const dados = {
    moendas: statusRows
      ? montarMoendas(statusRows).map(m => ({
          nome: m.nome,
          status: m.status,
          cor: m.statusColor,
          motivo: (m.motivo || '').replace(/^Motivo:\s*/i, '')
        }))
      : null,
    // Toneladas de hoje ÷ horas decorridas do dia
    moagemHoraHoje: moagemRows && moagemRows[0] ? num(moagemRows[0].HOJE) : null,
    mecanizada: colhedoraRows && manualRows
      ? { hoje: pctMecanizada(colhedoraRows, manualRows, 'hoje'), safra: pctMecanizada(colhedoraRows, manualRows, 'safra') }
      : null
  };
  // Só guarda em cache resposta completa (com a API fora, tenta de novo na próxima chamada)
  if (statusRows && moagemRows && colhedoraRows && manualRows) cache = { em: Date.now(), dados };
  res.json(dados);
});

module.exports = router;
