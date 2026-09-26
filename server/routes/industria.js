const express = require('express');
const router = express.Router();
const oracle = require('../db/oracle');
const queries = require('../db/queries');
const mock = require('../db/mockData');
const config = require('../config');

// GET /api/industria
router.get('/', async (req, res) => {
  try {
    if (oracle.isOracleConnected()) {
      const [statusRows, paradasRows, dathorRows] = await Promise.all([
        oracle.executeQuery(queries.industria.statusFabrica),
        oracle.executeQuery(queries.industria.paradasRecentes(config.safra)),
        oracle.executeQuery(queries.agricola.dataHoraAtual)
      ]);

      const dathor = (dathorRows && dathorRows[0]) ? dathorRows[0].DATHOR : '19/09/2026 11:30';
      const st = (statusRows && statusRows[0]) ? statusRows[0] : {};

      const hoje = new Date();
      const limiteMoendaA = new Date('2026-09-26T00:00:00-03:00');
      const isMoendaAParadaEntreSafra = hoje < limiteMoendaA;

      return res.json({
        dathor,
        moendas: [
          {
            id: 'moenda_a',
            nome: 'Moenda A',
            status: isMoendaAParadaEntreSafra ? 'Parada de Entre-Safra' : (st.STATUS_A || 'RODANDO'),
            statusColor: isMoendaAParadaEntreSafra ? 'slate' : (st.STATUS_A === 'PARADA' ? 'rose' : 'emerald'),
            motivo: isMoendaAParadaEntreSafra ? 'Aguardando início' : (st.MOTIVO_A || 'Sem ocorrências registradas'),
            dataHora: isMoendaAParadaEntreSafra ? '' : (st.DATAHORA_A || ''),
            horaIni: isMoendaAParadaEntreSafra ? '' : (st.HORAINI_A || ''),
            horaFim: isMoendaAParadaEntreSafra ? '' : (st.HORAFIM_A || ''),
            tempo: isMoendaAParadaEntreSafra ? '' : (st.TEMPO_A || '')
          },
          {
            id: 'moenda_b',
            nome: 'Moenda B',
            status: st.STATUS_B || 'RODANDO',
            statusColor: (st.STATUS_B === 'PARADA' ? 'rose' : 'emerald'),
            motivo: st.MOTIVO_B || 'Sem ocorrências registradas',
            dataHora: st.DATAHORA_B || '',
            horaIni: st.HORAINI_B || '',
            horaFim: st.HORAFIM_B || '',
            tempo: st.TEMPO_B || ''
          }
        ],
        paradas: (paradasRows || []).map(p => ({
          codObjeto: p.CODIGO_OBJETO,
          datmov: p.DATMOV,
          horaIni: p.HORAINI,
          horaFim: p.HORAFIM,
          tempoParada: p.TEMPO_PARADA,
          causa: p.DESC_CAUSA,
          objeto: p.DESC_OBJETO,
          observacao: p.OBSERVACAO
        })),
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
