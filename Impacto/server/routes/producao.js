const express = require('express');
const router = express.Router();
const oracle = require('../db/oracle');
const queries = require('../db/queries');
const mock = require('../db/mockData');
const config = require('../config');

// GET /api/producao (Produção Diária & Horária)
router.get('/', async (req, res) => {
  try {
    if (oracle.isOracleConnected()) {
      const [histRows, hidRows, aniRows, acuRows, totAcuRows, dathorRows] = await Promise.all([
        oracle.executeQuery(queries.producao.historicoDiario(config.safra)),
        oracle.executeQuery(queries.producao.producaoHorariaHidratado(config.safra)),
        oracle.executeQuery(queries.producao.producaoHorariaAnidro(config.safra)),
        oracle.executeQuery(queries.producao.producaoHorariaAcucar(config.safra)),
        oracle.executeQuery(queries.producao.totalSafraAcucar(config.safra)),
        oracle.executeQuery(queries.agricola.dataHoraAtual)
      ]);

      const dathor = (dathorRows && dathorRows[0]) ? dathorRows[0].DATHOR : '19/09/2026 11:30';
      const totAcu = (totAcuRows && totAcuRows[0]) ? totAcuRows[0] : { PRODUCAO: '0', SAIDA: '0', QTDCARROS: '0' };

      return res.json({
        dathor,
        historicoDiario: (histRows || []).map(r => ({
          datmov: r.DATMOV,
          canaEntrada: parseFloat(r.CANA_ENTRADA || 0),
          canaMoida: r.CANA_MOIDA !== null ? parseFloat(r.CANA_MOIDA) : null,
          eficiencia: r.EFICIENCIA !== null ? parseFloat(r.EFICIENCIA) : null,
          pcc: r.PCC !== null ? parseFloat(r.PCC) : null,
          atr: r.ATR !== null ? parseFloat(r.ATR) : null,
          ar: r.AR !== null ? parseFloat(r.AR) : null,
          pureza: r.PUREZA !== null ? parseFloat(r.PUREZA) : null,
          fibra: r.FIBRA !== null ? parseFloat(r.FIBRA) : null,
          tq: r.TQ || '-',
          prodEquiv: r.PRODUCAO_EQUIVALENTE !== null ? parseFloat(r.PRODUCAO_EQUIVALENTE) : null,
          prodHidratado: r.PRODUCAO_HIDRATADO !== null ? parseFloat(r.PRODUCAO_HIDRATADO) : null,
          prodAnidro: r.PRODUCAO_ANIDRO !== null ? parseFloat(r.PRODUCAO_ANIDRO) : null,
          prodAcucar: r.PRODUCAO_ACUCAR !== null ? parseFloat(r.PRODUCAO_ACUCAR) : null
        })),
        horarioHidratado: (hidRows || []).map(r => ({
          hora: r.HORA,
          descricao: r.DESCRICAO ? r.DESCRICAO.trim() : '',
          producao: r.PRODUCAO !== null ? parseFloat(r.PRODUCAO) : 0,
          saida: r.SAIDA !== null ? parseFloat(r.SAIDA) : 0,
          qtdCarros: r.QTDCARROS !== null ? parseInt(r.QTDCARROS, 10) : 0
        })),
        horarioAnidro: (aniRows || []).map(r => ({
          hora: r.HORA,
          descricao: r.DESCRICAO ? r.DESCRICAO.trim() : '',
          producao: r.PRODUCAO !== null ? parseFloat(r.PRODUCAO) : 0,
          saida: r.SAIDA !== null ? parseFloat(r.SAIDA) : 0,
          qtdCarros: r.QTDCARROS !== null ? parseInt(r.QTDCARROS, 10) : 0
        })),
        horarioAcucar: (acuRows || []).map(r => ({
          hora: r.HORA,
          descricao: r.DESCRICAO ? r.DESCRICAO.trim() : '',
          producao: r.PRODUCAO !== null ? parseFloat(r.PRODUCAO) : 0,
          saida: r.SAIDA !== null ? parseFloat(r.SAIDA) : 0,
          qtdCarros: r.QTDCARROS !== null ? parseInt(r.QTDCARROS, 10) : 0
        })),
        totaisSafra: {
          acucarProducao: parseFloat(totAcu.PRODUCAO || 0),
          acucarSaida: parseFloat(totAcu.SAIDA || 0),
          acucarCarros: parseInt(totAcu.QTDCARROS || 0, 10)
        },
        isLiveDb: true
      });
    }
  } catch (err) {
    console.error('Erro na rota producao:', err);
  }

  const data = mock.getMockProducaoData();
  res.json({ ...data, isLiveDb: false });
});

// GET /api/producao/semanal
router.get('/semanal', async (req, res) => {
  try {
    if (oracle.isOracleConnected()) {
      const [semanalRows, dathorRows] = await Promise.all([
        oracle.executeQuery(queries.producaoSemanal.tabelaSemanal(config.safra)),
        oracle.executeQuery(queries.agricola.dataHoraAtual)
      ]);

      const dathor = (dathorRows && dathorRows[0]) ? dathorRows[0].DATHOR : '19/09/2026 11:30';

      return res.json({
        dathor,
        semanas: (semanalRows || []).map(r => ({
          sem: r.SEM,
          periodo: r.PERIODO,
          datIni: r.DATINI,
          datFin: r.DATFIN,
          canaEntrada: parseFloat(r.CANA_ENTRADA || 0),
          canaMoida: r.CANA_MOIDA !== null ? parseFloat(r.CANA_MOIDA) : 0,
          eficiencia: r.EFICIENCIA !== null ? parseFloat(r.EFICIENCIA) : 0,
          pcc: r.PCC !== null ? parseFloat(r.PCC) : null,
          atr: r.ATR !== null ? parseFloat(r.ATR) : null,
          ar: r.AR !== null ? parseFloat(r.AR) : null,
          pureza: r.PUREZA !== null ? parseFloat(r.PUREZA) : null,
          fibra: r.FIBRA !== null ? parseFloat(r.FIBRA) : null,
          tq: r.TQ || '-',
          prodEquiv: r.PRODUCAO_EQUIVALENTE !== null ? parseFloat(r.PRODUCAO_EQUIVALENTE) : null,
          prodHidratado: r.PRODUCAO_HIDRATADO !== null ? parseFloat(r.PRODUCAO_HIDRATADO) : null,
          prodAnidro: r.PRODUCAO_ANIDRO !== null ? parseFloat(r.PRODUCAO_ANIDRO) : null,
          prodAcucar: r.PRODUCAO_ACUCAR !== null ? parseFloat(r.PRODUCAO_ACUCAR) : null
        })),
        isLiveDb: true
      });
    }
  } catch (err) {
    console.error('Erro na rota producao semanal:', err);
  }

  const data = mock.getMockProducaoData();
  res.json({ dathor: data.dathor, semanas: [], isLiveDb: false });
});

module.exports = router;
