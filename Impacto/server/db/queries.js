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
    resumoCompleto: (safra = config.safra) => q('agricola.resumo', { safra }),
    resumoColhedora: (safra = config.safra) => q('agricola.resumo', { safra, tipoCorte: 2 }),
    resumoManual: (safra = config.safra) => q('agricola.resumo', { safra, tipoCorte: 1 }),
    // Estimativa de Safra
    estimativaSafra: (safra = config.safra) => q('agricola.estimativaSafra', { safra }),
    // Rendimento TCH
    rendimentoTch: (safra = config.safra) => q('agricola.rendimentoTch', { safra }),
    // Resumo Mensal da Safra
    resumoMensal: (safra = config.safra) => q('agricola.resumoMensal', { safra }),
    // Estimado x planejado x colhido por lote (KPIs de cumprimento do planejamento)
    planejamentoColheita: (safra = config.safra) => q('agricola.planejamentoColheita', { safra }),
    // Detalhe por Fornecedor (Query 7 do mobile_detalhe.jsp)
    detalhePorFornecedor: (safra = config.safra, datini = '19/09/2026', datfin = '19/09/2026', horini = 0, horfin = 23, tipcol = 'T', tipo = '0') =>
      q('agricola.detalheFornecedor', detalheParams(safra, datini, datfin, horini, horfin, tipcol, tipo)),
    // Detalhe por Variedade (Query 8 do mobile_detalhe.jsp)
    detalhePorVariedade: (safra = config.safra, datini = '19/09/2026', datfin = '19/09/2026', horini = 0, horfin = 23, tipcol = 'T', tipo = '0') =>
      q('agricola.detalheVariedade', detalheParams(safra, datini, datfin, horini, horfin, tipcol, tipo))
  },

  // --- MÓDULO INDÚSTRIA ---
  industria: {
    statusFabrica: q('industria.statusFabrica'),
    // Boletim Diário de Ontem (Relatório 21)
    boletimDiario: (safra = config.safra) => q('industria.boletimDiario', { safra }),
    // Gráfico Entrada Cana Hoje vs Ontem (00h a 23h)
    graficoHojeOntem: (safra = config.safra) => q('industria.graficoHojeOntem', { safra }),
    // Gráfico Safra Atual vs Anterior por Mês
    graficoSafraComparativo: (safra = config.safra) => q('industria.graficoSafraComparativo', { safra }),
    // Gráfico Produção Mensal (Açúcar, Anidro, Hidratado)
    graficoProducaoMensal: (safra = config.safra) => q('industria.graficoProducaoMensal', { safra }),
    // Paradas Recentes (Query do mobile_Industria_paradas.jsp)
    paradasRecentes: () => q('industria.paradasRecentes'),
    // Minutos parados por causa em cada moenda: hoje, ontem e safra
    paradasPorCausa: () => q('industria.paradasPorCausa', comInicio({}))
  },

  // --- MÓDULO PRODUÇÃO DIÁRIA & HORÁRIA ---
  producao: {
    // Histórico Diário (Query 1 do mobile_Producao.jsp)
    historicoDiario: (safra = config.safra) => q('producao.historicoDiario', { safra }),
    producaoHorariaHidratado: (safra = config.safra) => q('producao.horariaHidratado', { safra }),
    producaoHorariaAnidro: (safra = config.safra) => q('producao.horariaAnidro', { safra }),
    producaoHorariaAcucar: (safra = config.safra) => q('producao.horariaAcucar', { safra }),
    totalSafraAcucar: (safra = config.safra) => q('producao.totalSafraAcucar', { safra })
  },

  // --- MÓDULO PRODUÇÃO SEMANAL ---
  producaoSemanal: {
    tabelaSemanal: (safra = config.safra) => q('producao.semanal', comInicio({ safra }))
  },

  // --- MÓDULO FROTA ---
  frota: {
    // 1. Transporte por Tipo de Equipamento (Query 1 do mobile_frota.jsp)
    transportePorTipo: (safra = config.safra) => q('frota.transportePorTipo', { safra }),
    // 2. Carregamento por Tipo de Equipamento (Query 2 do mobile_frota.jsp)
    carregamentoPorTipo: (safra = config.safra) => q('frota.carregamentoPorTipo', { safra }),
    // 3. Transporte por Proprietário (Query 3 do mobile_frota.jsp)
    transportePorProprietario: (safra = config.safra) => q('frota.transportePorProprietario', { safra }),
    // 4. Detalhamento por Equipamento (Queries do mobile_frota_detalhe.jsp)
    detalheEquipamentos: (safra = config.safra, tipo = 'T', codigo = null) =>
      q('frota.detalheEquipamentos', { safra, tipo: tipo === 'C' ? 'C' : 'T', codigo }),
    // 5. Disponibilidade da Frota (Query do mobile_frota_disposicao.jsp)
    disponibilidadeCompleta: (safra = config.safra) => q('frota.disponibilidade', comInicio({ safra }))
  },

  // --- CONTROLE DE ACESSO POR DISPOSITIVO ---
  acesso: {
    dispositivo: (hash) => q('acesso.dispositivo', { hash }),
    listar: () => q('acesso.listar'),
    solicitar: (dados) => q('acesso.solicitar', dados),
    liberarComCodigo: (hash) => q('acesso.liberarComCodigo', { hash }),
    alterarStatus: (id, status, por) => q('acesso.alterarStatus', { id, status, por }),
    definirAdmin: (id, admin, por) => q('acesso.definirAdmin', { id, admin, por }),
    excluir: (id) => q('acesso.excluir', { id }),
    registrarUso: (hash, ip) => q('acesso.registrarUso', { hash, ip })
  },

  // --- MÓDULO LABORATÓRIO (INDICADORES INDUSTRIAIS) ---
  laboratorio: {
    indicadores: (safra = config.safra) => q('laboratorio.indicadores', { safra }),
    moagemMedia: (safra = config.safra) => q('laboratorio.moagemMedia', comInicio({ safra }))
  }
};
