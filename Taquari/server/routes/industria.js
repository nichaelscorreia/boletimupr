const express = require('express');
const router = express.Router();
const oracle = require('../db/oracle');
const queries = require('../db/queries');
const mock = require('../db/mockData');
const config = require('../config');
const { montarMoendas } = require('../services/moendas');

// GET /api/industria
router.get('/', async (req, res) => {
  try {
    if (oracle.isOracleConnected()) {
      const [statusRows, paradasRows, dathorRows, causasRows] = await Promise.all([
        oracle.executeQuery(queries.industria.statusFabrica),
        oracle.executeQuery(queries.industria.paradasRecentes(config.safra)),
        oracle.executeQuery(queries.agricola.dataHoraAtual),
        oracle.executeQuery(queries.industria.paradasPorCausa())
      ]);

      const dathor = (dathorRows && dathorRows[0]) ? dathorRows[0].DATHOR : '19/09/2026 11:30';
      return res.json({
        dathor,
        moendas: montarMoendas(statusRows),
        paradas: (paradasRows || []).map(p => ({
          codObjeto: p.CODIGO_OBJETO,
          datmov: p.DATMOV,
          horaIni: p.HORAINI,
          horaFim: p.HORAFIM,
          tempoParada: p.TEMPO_PARADA,
          causa: p.DESC_CAUSA,
          objeto: p.DESC_OBJETO,
          observacao: p.MOTIVO
        })),
        // Por objeto de parada (2 = Recepção, 3 = Moenda): minutos parados por causa. null = consulta indisponível
        paradasPorCausa: causasRows ? causasRows.map(r => ({
          codObjeto: r.CODIGO_OBJETO,
          causa: (r.CAUSA || '').trim(),
          minHoje: parseInt(r.MIN_HOJE, 10) || 0,
          minOntem: parseInt(r.MIN_ONTEM, 10) || 0,
          minSafra: parseInt(r.MIN_SAFRA, 10) || 0,
          qtdSafra: parseInt(r.QTD_SAFRA, 10) || 0
        })) : null,
        isLiveDb: true
      });
    }
  } catch (err) {
    console.error('Erro na rota industria:', err);
  }

  const data = mock.getMockIndustriaData();
  res.json({ ...data, isLiveDb: false });
});

module.exports = router;
