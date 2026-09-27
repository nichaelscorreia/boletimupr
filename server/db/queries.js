// Descritores das consultas executadas pela Boletim API (Tomcat).
// Os SQLs ficam em tomcat-api/src/main/resources/sql e são validados/parametrizados lá;
// aqui só dizemos QUAL consulta executar e com QUAIS parâmetros.
const config = require('../config');

const q = (name, params = {}) => ({ name, params });

// Só envia inicioSafra se configurado; senão vale o padrão do Tomcat (INICIO_SAFRA_PADRAO)
const comInicio = (params) => (config.inicioSafra ? { ...params, inicioSafra: config.inicioSafra } : params);

const detalheParams = (safra, datini, datfin, horini, horfin, tipcol, tipo) =>
  ({ safra, datini, datfin, horini, horfin, tipcol, tipo });

module.exports = {
  // --- MÓDULO AGRÍCOLA ---
  agricola: {
    dataHoraAtual: q('agricola.dataHoraAtual'),

    // Resumo Completo (Query 4 do mobile_tela1.jsp)
    resumoCompleto: (safra = 54) => q('agricola.resumo', { safra }),
    resumoColhedora: (safra = 54) => q('agricola.resumo', { safra, tipoCorte: 2 }),
    resumoManual: (safra = 54) => q('agricola.resumo', { safra, tipoCorte: 1 }),
    // Estimativa de Safra
    estimativaSafra: (safra = 54) => q('agricola.estimativaSafra', { safra }),
    // Rendimento TCH
    rendimentoTch: (safra = 54) => q('agricola.rendimentoTch', { safra }),
    // Resumo Mensal da Safra
    resumoMensal: (safra = 54) => q('agricola.resumoMensal', { safra }),
    // Estimado x planejado x colhido por lote (KPIs de cumprimento do planejamento)
    planejamentoColheita: (safra = 54) => q('agricola.planejamentoColheita', { safra }),
    // Detalhe por Fornecedor (Query 7 do mobile_detalhe.jsp)
    detalhePorFornecedor: (safra = 54, datini = '19/09/2026', datfin = '19/09/2026', horini = 0, horfin = 23, tipcol = 'T', tipo = '0') =>
      q('agricola.detalheFornecedor', detalheParams(safra, datini, datfin, horini, horfin, tipcol, tipo)),
    // Detalhe por Variedade (Query 8 do mobile_detalhe.jsp)
    detalhePorVariedade: (safra = 54, datini = '19/09/2026', datfin = '19/09/2026', horini = 0, horfin = 23, tipcol = 'T', tipo = '0') =>
      q('agricola.detalheVariedade', detalheParams(safra, datini, datfin, horini, horfin, tipcol, tipo))
  },

  // --- MÓDULO INDÚSTRIA ---
  industria: {
    statusFabrica: q('industria.statusFabrica'),
    // Boletim Diário de Ontem (Relatório 21)
    boletimDiario: (safra = 54) => q('industria.boletimDiario', { safra }),
    // Gráfico Entrada Cana Hoje vs Ontem (00h a 23h)
    graficoHojeOntem: (safra = 54) => q('industria.graficoHojeOntem', { safra }),
    // Gráfico Safra Atual vs Anterior por Mês
    graficoSafraComparativo: (safra = 54) => q('industria.graficoSafraComparativo', { safra }),
    // Gráfico Produção Mensal (Açúcar, Anidro, Hidratado)
    graficoProducaoMensal: (safra = 54) => q('industria.graficoProducaoMensal', { safra }),
    // Paradas Recentes (Query do mobile_Industria_paradas.jsp)
    paradasRecentes: () => q('industria.paradasRecentes')
  },

  // --- MÓDULO PRODUÇÃO DIÁRIA & HORÁRIA ---
  producao: {
    // Histórico Diário (Query 1 do mobile_Producao.jsp)
    historicoDiario: (safra = 54) => q('producao.historicoDiario', { safra }),
    producaoHorariaHidratado: (safra = 54) => q('producao.horariaHidratado', { safra }),
    producaoHorariaAnidro: (safra = 54) => q('producao.horariaAnidro', { safra }),
    producaoHorariaAcucar: (safra = 54) => q('producao.horariaAcucar', { safra }),
    totalSafraAcucar: (safra = 54) => q('producao.totalSafraAcucar', { safra })
  },

  // --- MÓDULO PRODUÇÃO SEMANAL ---
  producaoSemanal: {
    tabelaSemanal: (safra = 54) => q('producao.semanal', comInicio({ safra }))
  },

  // --- MÓDULO FROTA ---
  frota: {
    // 1. Transporte por Tipo de Equipamento (Query 1 do mobile_frota.jsp)
    transportePorTipo: (safra = 54) => q('frota.transportePorTipo', { safra }),
    // 2. Carregamento por Tipo de Equipamento (Query 2 do mobile_frota.jsp)
    carregamentoPorTipo: (safra = 54) => q('frota.carregamentoPorTipo', { safra }),
    // 3. Transporte por Proprietário (Query 3 do mobile_frota.jsp)
    transportePorProprietario: (safra = 54) => q('frota.transportePorProprietario', { safra }),
    // 4. Detalhamento por Equipamento (Queries do mobile_frota_detalhe.jsp)
    detalheEquipamentos: (safra = 54, tipo = 'T', codigo = null) =>
      q('frota.detalheEquipamentos', { safra, tipo: tipo === 'C' ? 'C' : 'T', codigo }),
    // 5. Disponibilidade da Frota (Query do mobile_frota_disposicao.jsp)
    disponibilidadeCompleta: (safra = 54) => q('frota.disponibilidade', comInicio({ safra }))
  },

  // --- MÓDULO LABORATÓRIO (INDICADORES INDUSTRIAIS) ---
  laboratorio: {
    indicadores: (safra = 54) => q('laboratorio.indicadores', { safra }),
    moagemMedia: (safra = 54) => q('laboratorio.moagemMedia', comInicio({ safra }))
  }
};
