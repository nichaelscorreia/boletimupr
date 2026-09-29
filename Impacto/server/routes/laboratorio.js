const express = require('express');
const router = express.Router();
const oracle = require('../db/oracle');
const queries = require('../db/queries');
const mock = require('../db/mockData');
const config = require('../config');

// GET /api/laboratorio (14 Indicadores Industriais + Relógio)
router.get('/', async (req, res) => {
  try {
    if (oracle.isOracleConnected()) {
      const [indicRows, moagemRows, dathorRows] = await Promise.all([
        oracle.executeQuery(queries.laboratorio.indicadores(config.safra)),
        oracle.executeQuery(queries.laboratorio.moagemMedia(config.safra)),
        oracle.executeQuery(queries.agricola.dataHoraAtual)
      ]);

      const dathor = (dathorRows && dathorRows[0]) ? dathorRows[0].DATHOR : '19/09/2026 11:30';
      const moagem = (moagemRows && moagemRows[0]) ? moagemRows[0] : { HOJE: 25, ONTEM: 25, SAFRA: 25 };

      const indicMap = {};
      (indicRows || []).forEach(r => {
        indicMap[r.VAR] = {
          ontem: r.ONTEM !== null ? parseFloat(r.ONTEM) : null,
          hoje: r.HOJE !== null ? parseFloat(r.HOJE) : null,
          safra: r.SAFRA !== null ? parseFloat(r.SAFRA) : null
        };
      });

      const getVal = (varNames, defaultOntem = 0, defaultHoje = 0, defaultSafra = 0) => {
        for (const v of varNames) {
          if (indicMap[v] && (indicMap[v].hoje !== null || indicMap[v].ontem !== null || indicMap[v].safra !== null)) {
            return {
              ontem: indicMap[v].ontem !== null ? indicMap[v].ontem : defaultOntem,
              hoje: indicMap[v].hoje !== null ? indicMap[v].hoje : defaultHoje,
              safra: indicMap[v].safra !== null ? indicMap[v].safra : defaultSafra
            };
          }
        }
        return { ontem: defaultOntem, hoje: defaultHoje, safra: defaultSafra };
      };

      const artBag = getVal(['ART_BA'], 0, 0, 0);
      const artTor = getVal(['ART_TO'], 1.33, 0.35, 0.35);
      const polTor = getVal(['PL_TO', 'MD_POL_TO'], 1.26, 0.33, 0.33);
      const atrVal = getVal(['ATR_CONSECANA', 'ATR'], 103.6709, 95.4000, 95.4000);
      const fibraVal = getVal(['FBR_CONSECANA', 'FBR_PCTS'], 14.49, 16.13, 16.13);
      const gerTosh = getVal(['GER_TOSHB'], 996, 0, 0);
      const gerWeg = getVal(['GER_WEG'], 5225, 4475, 4475);
      const totGer = getVal(['TOT_GER'], 6221, 4475, 4475);
      const phCal = getVal(['PH_CF', 'PH_CM'], 7.19, 8.82, 8.82);
      const polCal = getVal(['PL_CF', 'PL_CM'], 0.00, 0.00, 0.00);
      const purCal = getVal(['PR_CF', 'PR_CM'], 0.00, 0.00, 0.00);
      const impMin = getVal(['IMP_MINERAL_MANUAL', 'PI_VG_KG'], 7.26, 0.00, 0.00);
      const impPal = getVal(['%IMP_PALHA'], 4.28, 0.00, 0.00);

      const checkStatus = (val, min, max) => {
        if (val === null || val === undefined) return 'normal';
        return (val >= min && val <= max) ? 'normal' : 'alerta';
      };

      const cards = [
        {
          id: 'moagem_media',
          titulo: 'Média Moagem Horária',
          unidade: 'Ton',
          formatoDecimais: 0,
          ontem: parseFloat(moagem.ONTEM || 25),
          hoje: parseFloat(moagem.HOJE || 25),
          safra: parseFloat(moagem.SAFRA || 25),
          refMin: 450,
          refMax: 500,
          refTexto: 'Referência 450 à 500',
          status: checkStatus(parseFloat(moagem.HOJE || 25), 450, 500)
        },
        {
          id: 'art_bagaco',
          titulo: 'ART BAGACO',
          unidade: '%',
          formatoDecimais: 2,
          ontem: artBag.ontem,
          hoje: artBag.hoje,
          safra: artBag.safra,
          refMin: 0.00,
          refMax: 5.00,
          refTexto: 'Referência 0,00 à 5,00',
          status: checkStatus(artBag.hoje, 0.00, 5.00)
        },
        {
          id: 'art_torta',
          titulo: 'ART TORTA',
          unidade: '%',
          formatoDecimais: 2,
          ontem: artTor.ontem,
          hoje: artTor.hoje,
          safra: artTor.safra,
          refMin: 0.00,
          refMax: 2.50,
          refTexto: 'Referência 0,00 à 2,50',
          status: checkStatus(artTor.hoje, 0.00, 2.50)
        },
        {
          id: 'pol_torta',
          titulo: 'POL TORTA',
          unidade: '%',
          formatoDecimais: 2,
          ontem: polTor.ontem,
          hoje: polTor.hoje,
          safra: polTor.safra,
          refMin: 0.00,
          refMax: 2.50,
          refTexto: 'Referência 0,00 à 2,50',
          status: checkStatus(polTor.hoje, 0.00, 2.50)
        },
        {
          id: 'atr',
          titulo: 'ATR',
          unidade: '%',
          formatoDecimais: 4,
          ontem: atrVal.ontem,
          hoje: atrVal.hoje,
          safra: atrVal.safra,
          refMin: 114.00,
          refMax: 200.00,
          refTexto: 'Referência 114 à 200,00',
          status: checkStatus(atrVal.hoje, 114.00, 200.00)
        },
        {
          id: 'fibra',
          titulo: 'FIBRA',
          unidade: '%',
          formatoDecimais: 2,
          ontem: fibraVal.ontem,
          hoje: fibraVal.hoje,
          safra: fibraVal.safra,
          refMin: 0.00,
          refMax: 100.00,
          refTexto: 'Referência 0,00 à 100',
          status: checkStatus(fibraVal.hoje, 0.00, 100.00)
        },
        {
          id: 'gerador_toshiba',
          titulo: 'GERADOR TOSHIBA',
          unidade: 'KW',
          formatoDecimais: 0,
          ontem: gerTosh.ontem,
          hoje: gerTosh.hoje,
          safra: gerTosh.safra,
          refMin: 0,
          refMax: 5000,
          refTexto: 'Referência 0 à 5000',
          status: checkStatus(gerTosh.hoje, 0, 5000)
        },
        {
          id: 'gerador_weg',
          titulo: 'GERADOR WEG',
          unidade: 'KW',
          formatoDecimais: 0,
          ontem: gerWeg.ontem,
          hoje: gerWeg.hoje,
          safra: gerWeg.safra,
          refMin: 0,
          refMax: 10000,
          refTexto: 'Referência 0 à 10000',
          status: checkStatus(gerWeg.hoje, 0, 10000)
        },
        {
          id: 'tot_geradores',
          titulo: 'TOT GERADORES',
          unidade: 'KW',
          formatoDecimais: 0,
          ontem: totGer.ontem,
          hoje: totGer.hoje,
          safra: totGer.safra,
          refMin: 0,
          refMax: 99999999,
          refTexto: 'Referência 0 à 99999999',
          status: checkStatus(totGer.hoje, 0, 99999999)
        },
        {
          id: 'ph_caldo',
          titulo: 'PH CALDO',
          unidade: '-',
          formatoDecimais: 2,
          ontem: phCal.ontem,
          hoje: phCal.hoje,
          safra: phCal.safra,
          refMin: 7.20,
          refMax: 7.60,
          refTexto: 'Referência 7,2 à 7,6',
          status: checkStatus(phCal.hoje, 7.20, 7.60)
        },
        {
          id: 'pol_caldo',
          titulo: 'POL CALDO',
          unidade: '%',
          formatoDecimais: 2,
          ontem: polCal.ontem,
          hoje: polCal.hoje,
          safra: polCal.safra,
          refMin: 7.00,
          refMax: 14.00,
          refTexto: 'Referência 7 à 14',
          status: checkStatus(polCal.hoje, 7.00, 14.00)
        },
        {
          id: 'pureza_caldo',
          titulo: 'PUREZA CALDO',
          unidade: '%',
          formatoDecimais: 2,
          ontem: purCal.ontem,
          hoje: purCal.hoje,
          safra: purCal.safra,
          refMin: 78.00,
          refMax: 84.00,
          refTexto: 'Referência 78 à 84',
          status: checkStatus(purCal.hoje, 78.00, 84.00)
        },
        {
          id: 'impureza_mineral',
          titulo: 'IMPUREZA MINERAL',
          unidade: 'KG/T',
          formatoDecimais: 2,
          ontem: impMin.ontem,
          hoje: impMin.hoje,
          safra: impMin.safra,
          refMin: 0.00,
          refMax: 10.00,
          refTexto: 'Referência 0 à 10',
          status: checkStatus(impMin.hoje, 0.00, 10.00)
        },
        {
          id: 'impureza_palha',
          titulo: 'PERC. IMPUREZA PALHA',
          unidade: '%',
          formatoDecimais: 2,
          ontem: impPal.ontem,
          hoje: impPal.hoje,
          safra: impPal.safra,
          refMin: 0.00,
          refMax: 100.00,
          refTexto: 'Referência 0 à 100',
          status: checkStatus(impPal.hoje, 0.00, 100.00)
        }
      ];

      return res.json({
        dathor,
        cards,
        isLiveDb: true
      });
    }
  } catch (err) {
    console.error('Erro na rota laboratorio:', err);
  }

  const data = mock.getMockLaboratorioData ? mock.getMockLaboratorioData() : { dathor: '19/09/2026 11:30', cards: [] };
  res.json({ ...data, isLiveDb: false });
});

module.exports = router;
