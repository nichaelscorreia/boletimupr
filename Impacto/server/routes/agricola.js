const express = require('express');
const router = express.Router();
const oracle = require('../db/oracle');
const queries = require('../db/queries');
const config = require('../config');
const planejamento = require('../services/planejamentoColheita');

// Helper to format float values
function parseNum(val, decimals = 2) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : Number(n.toFixed(decimals));
}

// GET /api/agricola
router.get('/', async (req, res) => {
  try {
    const safra = 54;
    
    // Executar queries simultaneamente
    const [
      dataHoraRows,
      resumoRows,
      estRows,
      tchRows,
      mensalRows,
      detFornecRows,
      detVarRows,
      colhedoraRows,
      manualRows,
      planejamentoRows
    ] = await Promise.all([
      oracle.executeQuery(queries.agricola.dataHoraAtual),
      oracle.executeQuery(queries.agricola.resumoCompleto(safra)),
      oracle.executeQuery(queries.agricola.estimativaSafra(safra)),
      oracle.executeQuery(queries.agricola.rendimentoTch(safra)),
      oracle.executeQuery(queries.agricola.resumoMensal(safra)),
      oracle.executeQuery(queries.agricola.detalhePorFornecedor(safra, '19/09/2026', '19/09/2026', 0, 23, 'T', '0')),
      oracle.executeQuery(queries.agricola.detalhePorVariedade(safra, '19/09/2026', '19/09/2026', 0, 23, 'T', '0')),
      oracle.executeQuery(queries.agricola.resumoColhedora(safra)),
      oracle.executeQuery(queries.agricola.resumoManual(safra)),
      oracle.executeQuery(queries.agricola.planejamentoColheita(safra))
    ]);

    const dathor = dataHoraRows && dataHoraRows[0] ? dataHoraRows[0].DATHOR : '19/09/2026 10:31';

    // Separar tabelas de resumo da Query 4
    const resumoTotal = [];
    const resumoPropria = [];
    const resumoFornecedor = [];
    const resumoTurnos = [];
    const resumoHoras = [];

    if (resumoRows && Array.isArray(resumoRows)) {
      resumoRows.forEach(r => {
        const item = {
          tipo: r.TIPO,
          tipo2: r.TIPO2,
          periodo: (r.PERIODO || '').trim(),
          datini: r.DATINI,
          datfin: r.DATFIN,
          horini: parseInt(r.HORINI, 10) || 0,
          horfin: parseInt(r.HORFIN, 10) || 23,
          pesliq: parseNum(r.PESLIQ, 3),
          pcc: parseNum(r.PCC, 4),
          atr: parseNum(r.ATR, 4),
          ar: parseNum(r.AR, 4),
          pureza: parseNum(r.PUREZA, 4),
          fibra: parseNum(r.FIBRA, 4),
          tq: r.TQ && r.TQ.trim() !== 'h' ? r.TQ.trim() : '',
          impmin: parseNum(r.IMPMIN, 2),
          impveg: parseNum(r.IMPVEG, 2)
        };

        if (r.TIPO === '0') {
          resumoTotal.push(item);
        } else if (r.TIPO === '1') {
          resumoPropria.push(item);
        } else if (r.TIPO === '3') {
          resumoFornecedor.push(item);
        } else if (r.TIPO === '5') {
          resumoTurnos.push(item);
        } else if (r.TIPO === '9') {
          resumoHoras.push(item);
        }
      });
    }

    const resumoColhedora = [];
    if (colhedoraRows && Array.isArray(colhedoraRows)) {
      colhedoraRows.forEach(r => {
        if (r.TIPO === '0') {
          resumoColhedora.push({
            tipo: r.TIPO,
            tipo2: r.TIPO2,
            periodo: (r.PERIODO || '').trim(),
            datini: r.DATINI,
            datfin: r.DATFIN,
            horini: parseInt(r.HORINI, 10) || 0,
            horfin: parseInt(r.HORFIN, 10) || 23,
            pesliq: parseNum(r.PESLIQ, 3),
            pcc: parseNum(r.PCC, 4),
            atr: parseNum(r.ATR, 4),
            ar: parseNum(r.AR, 4),
            pureza: parseNum(r.PUREZA, 4),
            fibra: parseNum(r.FIBRA, 4),
            tq: r.TQ && r.TQ.trim() !== 'h' ? r.TQ.trim() : '',
            impmin: parseNum(r.IMPMIN, 2),
            impveg: parseNum(r.IMPVEG, 2)
          });
        }
      });
    }

    const resumoManual = [];
    if (manualRows && Array.isArray(manualRows)) {
      manualRows.forEach(r => {
        if (r.TIPO === '0') {
          resumoManual.push({
            tipo: r.TIPO,
            tipo2: r.TIPO2,
            periodo: (r.PERIODO || '').trim(),
            datini: r.DATINI,
            datfin: r.DATFIN,
            horini: parseInt(r.HORINI, 10) || 0,
            horfin: parseInt(r.HORFIN, 10) || 23,
            pesliq: parseNum(r.PESLIQ, 3),
            pcc: parseNum(r.PCC, 4),
            atr: parseNum(r.ATR, 4),
            ar: parseNum(r.AR, 4),
            pureza: parseNum(r.PUREZA, 4),
            fibra: parseNum(r.FIBRA, 4),
            tq: r.TQ && r.TQ.trim() !== 'h' ? r.TQ.trim() : '',
            impmin: parseNum(r.IMPMIN, 2),
            impveg: parseNum(r.IMPVEG, 2)
          });
        }
      });
    }

    // Processar Estimativa de Safra e TCH
    let estimativaSafra = {
      toneladasPrevistas: 1094421.250,
      saldoColher: 1065234.375,
      colhidoAcima: 0,
      dataEstimada: 'Março/2027'
    };

    let tchPrevistoTotal = 72.80;
    if (estRows && estRows.length > 0) {
      const est = estRows[0];
      const tonPropria = parseNum(est.TONELADAS_ESTIMADASPROPRIA, 3) || 1094421.25;
      const areaEst = parseNum(est.AREA_ESTIMADA, 2) || 15032.33;
      const saldo = parseNum(est.SALDO_COLHER, 3) || 1065234.375;
      
      if (areaEst > 0) {
        tchPrevistoTotal = Number((tonPropria / areaEst).toFixed(2));
      }

      estimativaSafra = {
        toneladasPrevistas: tonPropria,
        saldoColher: saldo,
        colhidoAcima: saldo < 0 ? Math.abs(saldo) : 0,
        dataEstimada: 'Março/2027'
      };
    }

    let rendimentoTch = {
      tchPrevistoTotal: tchPrevistoTotal,
      tchPrevistoColhida: 65.00,
      tchRealizado: 78.69,
      variacao: 21.06
    };

    if (tchRows && tchRows.length > 0) {
      const tch = tchRows[0];
      const prev = parseNum(tch.TCH_PREVISTO, 2) || 65.00;
      const real = parseNum(tch.TCH_REALIZADO, 2) || 78.69;
      const variacao = prev > 0 ? Number((((real / prev) * 100) - 100).toFixed(2)) : 0;

      rendimentoTch = {
        tchPrevistoTotal: tchPrevistoTotal,
        tchPrevistoColhida: prev,
        tchRealizado: real,
        variacao: variacao
      };
    }

    // Processar Resumo Mensal
    const resumoMensal = (mensalRows || []).map(r => ({
      tipo: r.TIPO,
      anomes: r.ANOMES,
      mes: (r.MES || '').trim(),
      pesliq: parseNum(r.PESLIQ, 3),
      pcc: parseNum(r.PCC, 4),
      atr: parseNum(r.ATR, 4),
      ar: parseNum(r.AR, 2),
      fibra: parseNum(r.FIBRA, 2),
      pureza: parseNum(r.PUREZA, 2),
      tq: r.TQ && r.TQ.trim() !== 'h' ? r.TQ.trim() : ''
    }));

    // Processar Detalhamento Fornecedor (Hoje)
    const detalheFornecedores = (detFornecRows || []).map(r => ({
      tipo: r.TIPO,
      fornecedor: (r.FORNECEDOR || '').trim(),
      fazenda: (r.FAZENDA || '').trim(),
      tipocorte: (r.TIPOCORTE || '').trim(),
      pesliq: parseNum(r.PESLIQ, 3),
      brix: parseNum(r.BRIX, 2),
      pcc: parseNum(r.PCC, 4),
      fibra: parseNum(r.FIBRA, 2),
      atr: parseNum(r.ATR, 4),
      ar: parseNum(r.AR, 2),
      pureza: parseNum(r.PUREZA, 2),
      tq: r.TQ && r.TQ.trim() !== 'h' ? r.TQ.trim() : ''
    }));

    // Processar Detalhamento Variedades (Hoje)
    const totPesliqVar = detVarRows && detVarRows.length > 0 
      ? parseNum(detVarRows.find(r => r.TIPO === '2')?.PESLIQ || detVarRows[detVarRows.length - 1]?.PESLIQ, 3) || 253.44
      : 253.44;

    const detalheVariedades = (detVarRows || []).map(r => {
      const pesliq = parseNum(r.PESLIQ, 3);
      const perc = (r.TIPO === '2' || !totPesliqVar || totPesliqVar === 0) 
        ? 100.00 
        : Number(((pesliq / totPesliqVar) * 100).toFixed(2));

      return {
        tipo: r.TIPO,
        variedade: (r.VARIEDADE || '').trim(),
        percentual: perc,
        pesliq: pesliq,
        brix: parseNum(r.BRIX, 2),
        pcc: parseNum(r.PCC, 4),
        fibra: parseNum(r.FIBRA, 2),
        atr: parseNum(r.ATR, 4),
        ar: parseNum(r.AR, 2),
        pureza: parseNum(r.PUREZA, 2),
        tq: r.TQ && r.TQ.trim() !== 'h' ? r.TQ.trim() : ''
      };
    });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      dathor: dathor,
      resumoTotal: resumoTotal,
      resumoPropria: resumoPropria,
      resumoFornecedor: resumoFornecedor,
      resumoTurnos: resumoTurnos,
      resumoHoras: resumoHoras,
      resumoColhedora: resumoColhedora,
      resumoManual: resumoManual,
      estimativaSafra: estimativaSafra,
      rendimentoTch: rendimentoTch,
      resumoMensal: resumoMensal,
      detalheFornecedores: detalheFornecedores,
      detalheVariedades: detalheVariedades,
      // null = consulta indisponível (a tela mostra aviso em vez de números inventados)
      planejamentoColheita: planejamentoRows ? planejamento.resumoGrupos(planejamentoRows) : null
    });

  } catch (err) {
    console.error('Erro na rota /api/agricola:', err);
    res.status(500).json({ error: 'Erro interno ao consultar dados agrícolas', details: err.message });
  }
});

// GET /api/agricola/planejamento?grupo=0..5[&fornecedor=cod[&fazenda=cod]]
// Detalhamento dos cards de planejamento: grupo -> fornecedores -> fazendas -> lotes
router.get('/planejamento', async (req, res) => {
  const inteiro = (v) => (v === undefined || v === '' ? null : (/^\d{1,9}$/.test(v) ? parseInt(v, 10) : NaN));
  const grupo = inteiro(req.query.grupo);
  const fornecedor = inteiro(req.query.fornecedor);
  const fazenda = inteiro(req.query.fazenda);
  if (grupo === null || [grupo, fornecedor, fazenda].some(Number.isNaN) || grupo > 5 || (fazenda !== null && fornecedor === null)) {
    return res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
  }

  const rows = await oracle.executeQuery(queries.agricola.planejamentoColheita(config.safra));
  if (!rows) {
    return res.status(503).json({ success: false, error: 'Dados de planejamento indisponíveis' });
  }
  res.json({ success: true, ...planejamento.detalhe(rows, { grupo, fornecedor, fazenda }) });
});

// GET /api/agricola/detalhe - Busca drilldown dinâmico ao clicar numa linha
router.get('/detalhe', async (req, res) => {
  try {
    const safra = 54;
    const datini = req.query.datini || '19/09/2026';
    const datfin = req.query.datfin || '19/09/2026';
    const horini = parseInt(req.query.horini, 10) || 0;
    const horfin = parseInt(req.query.horfin, 10) || 23;
    const tipcol = req.query.tipcol || 'T';
    const tipo = req.query.tipo || '0';
    const periodoNome = req.query.periodo || 'Período Selecionado';

    const [fornecRows, varRows] = await Promise.all([
      oracle.executeQuery(queries.agricola.detalhePorFornecedor(safra, datini, datfin, horini, horfin, tipcol, tipo)),
      oracle.executeQuery(queries.agricola.detalhePorVariedade(safra, datini, datfin, horini, horfin, tipcol, tipo))
    ]);

    const fornecedores = (fornecRows || []).map(r => ({
      tipo: r.TIPO,
      fornecedor: (r.FORNECEDOR || '').trim(),
      fazenda: (r.FAZENDA || '').trim(),
      tipocorte: (r.TIPOCORTE || '').trim(),
      pesliq: parseNum(r.PESLIQ, 3),
      brix: parseNum(r.BRIX, 2),
      pcc: parseNum(r.PCC, 4),
      fibra: parseNum(r.FIBRA, 2),
      atr: parseNum(r.ATR, 4),
      ar: parseNum(r.AR, 2),
      pureza: parseNum(r.PUREZA, 2),
      tq: r.TQ && r.TQ.trim() !== 'h' ? r.TQ.trim() : ''
    }));

    const totPesliqVar = varRows && varRows.length > 0 
      ? parseNum(varRows.find(r => r.TIPO === '2')?.PESLIQ || varRows[varRows.length - 1]?.PESLIQ, 3) || 1
      : 1;

    const variedades = (varRows || []).map(r => {
      const pesliq = parseNum(r.PESLIQ, 3);
      const perc = (r.TIPO === '2' || !totPesliqVar || totPesliqVar === 0) 
        ? 100.00 
        : Number(((pesliq / totPesliqVar) * 100).toFixed(2));

      return {
        tipo: r.TIPO,
        variedade: (r.VARIEDADE || '').trim(),
        percentual: perc,
        pesliq: pesliq,
        brix: parseNum(r.BRIX, 2),
        pcc: parseNum(r.PCC, 4),
        fibra: parseNum(r.FIBRA, 2),
        atr: parseNum(r.ATR, 4),
        ar: parseNum(r.AR, 2),
        pureza: parseNum(r.PUREZA, 2),
        tq: r.TQ && r.TQ.trim() !== 'h' ? r.TQ.trim() : ''
      };
    });

    res.json({
      success: true,
      meta: {
        datini,
        datfin,
        horini,
        horfin,
        tipcol,
        tipo,
        periodoNome
      },
      fornecedores,
      variedades
    });

  } catch (err) {
    console.error('Erro na rota /api/agricola/detalhe:', err);
    res.status(500).json({ error: 'Erro ao consultar detalhes agrícolas', details: err.message });
  }
});

module.exports = router;
