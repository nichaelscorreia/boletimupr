// Ferramentas (tool use) do assistente de dados. Todas são SOMENTE LEITURA e usam as mesmas rotas
// que alimentam as telas do painel — o assistente responde com os mesmos números que o usuário vê.
const config = require('../../config');
const oracle = require('../../db/oracle');
const queries = require('../../db/queries');
const planejamento = require('../planejamentoColheita');
const { chamarRota } = require('./rotaInterna');

const rotas = {
  agricola: require('../../routes/agricola'),
  industria: require('../../routes/industria'),
  producao: require('../../routes/producao'),
  frota: require('../../routes/frota'),
  laboratorio: require('../../routes/laboratorio')
};

const DATA = /^\d{2}\/\d{2}\/\d{4}$/;
const MAX_CARACTERES = 60000; // limite de tamanho de cada resultado devolvido ao modelo

// Definições enviadas ao modelo (ordem fixa: faz parte do prefixo em cache)
const DEFINICOES = [
  {
    name: 'resumo_agricola',
    description:
      'Resumo da aba Agrícola: entrada de cana (toneladas) com ATR, impurezas vegetal/mineral e tempo de queima, ' +
      'por período (Hoje, Estimativa do dia, Ontem, Semana, Sem.Ant, Safra, Média/Dia) para cana TOTAL, PRÓPRIA, ' +
      'FORNECEDOR, COLHEDORA (mecanizada) e CORTE MANUAL; também turnos e horas de hoje; resumo mensal e por tipo de ' +
      'fazenda com PCC/ATR/AR/fibra/pureza/TQ; TCH previsto x realizado; e o planejamento de colheita resumido por ' +
      'grupo (Cana Total, Própria, Acionistas, Triunfo, Sinimbú, Fornecedores) com planejado, colhido, saldo, % evolução ' +
      'e % cumprimento. Use para perguntas gerais de moagem/entrada de cana por período padrão.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'entrada_cana_detalhada',
    description:
      'Entrada de cana num intervalo de datas e horas QUALQUER, detalhada por fornecedor + fazenda + tipo de corte ' +
      '(toneladas, Brix, PCC, Fibra, ATR, AR, Pureza, tempo de queima) e por variedade de cana, mais o total geral ' +
      'do período. Use para: produção/entrada de cana de uma fazenda ou fornecedor num dia, ' +
      'semana, mês ou na safra inteira (data_inicial = início da safra); ranking de fazendas/fornecedores por ATR ou ' +
      'qualquer outro indicador de qualidade; comparação entre variedades.',
    input_schema: {
      type: 'object',
      properties: {
        data_inicial: { type: 'string', description: 'dd/mm/aaaa' },
        data_final: { type: 'string', description: 'dd/mm/aaaa' },
        hora_inicial: { type: 'integer', minimum: 0, maximum: 23, description: 'Hora de saída da balança inicial (padrão 0)' },
        hora_final: { type: 'integer', minimum: 0, maximum: 23, description: 'Hora final (padrão 23)' },
        tipo_colheita: { type: 'string', enum: ['T', 'M', 'MAN'], description: 'T = todas, M = mecanizada (colhedora), MAN = manual' },
        tipo_fazenda: { type: 'integer', enum: [0, 1, 2, 3], description: '0 = todos; 1, 2 ou 3 filtram o tipo de fazenda' },
        ordenar_por: {
          type: 'string', enum: ['toneladas', 'brix', 'pcc', 'fibra', 'atr', 'ar', 'pureza', 'tq'],
          description: 'Devolve as linhas já ordenadas do maior para o menor valor desse indicador. Use em rankings.'
        }
      },
      required: ['data_inicial', 'data_final'],
      additionalProperties: false
    }
  },
  {
    name: 'planejamento_colheita',
    description:
      'Planejamento de colheita x realizado da safra (dados por lote/talhão): estimado, planejado até hoje, colhido, ' +
      'colhido fora do plano, saldo a colher, % evolução (colhido ÷ estimado) e % cumprimento (colhido ÷ planejado). ' +
      'Grupos: 0 = Cana Total, 1 = Própria, 2 = Acionistas, 3 = Triunfo, 4 = Sinimbú, 5 = Fornecedores. ' +
      'Sem parâmetros extras lista os fornecedores do grupo (com códigos); com cod_fornecedor lista as fazendas; com ' +
      'cod_fornecedor + cod_fazenda lista os lotes (com data prevista de colheita). Para achar uma fazenda pelo nome, ' +
      'use nome_fazenda (traz a fazenda e os seus lotes). As listas de lotes trazem só os que têm planejamento até ' +
      'hoje ou colheita; os demais vêm apenas contados (use incluir_lotes_sem_movimento=true se precisar deles).',
    input_schema: {
      type: 'object',
      properties: {
        grupo: { type: 'integer', enum: [0, 1, 2, 3, 4, 5] },
        cod_fornecedor: { type: 'integer' },
        cod_fazenda: { type: 'integer' },
        nome_fazenda: { type: 'string', description: 'Parte do nome da fazenda (sem distinção de acento/maiúsculas)' },
        incluir_lotes_sem_movimento: { type: 'boolean', description: 'true lista também os lotes sem plano e sem colheita (padrão false)' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'painel_industria',
    description:
      'Status atual das moendas (A e B: rodando/parada, motivo, desde quando), minutos parados por causa em cada ' +
      'moenda (hoje, ontem e na safra, com quantidade de paradas na safra) e lista das paradas recentes com horário, ' +
      'duração, causa e observação. A lista cobre os últimos 7 dias; use dias_paradas (até 15) para um período maior.',
    input_schema: {
      type: 'object',
      properties: { dias_paradas: { type: 'integer', minimum: 1, maximum: 15, description: 'Dias da lista de paradas recentes (padrão 7)' } },
      additionalProperties: false
    }
  },
  {
    name: 'producao_industrial',
    description:
      'Produção industrial. visao "diaria": histórico diário da safra (cana de entrada, cana moída, eficiência, ' +
      'PCC, ATR, pureza, fibra, produção equivalente, álcool hidratado, anidro e açúcar por dia), produção hora a hora ' +
      'de hoje (hidratado, anidro, açúcar, com saídas/carregamentos) e total acumulado de açúcar na safra. ' +
      'visao "semanal": fechamentos por semana da safra.',
    input_schema: {
      type: 'object',
      properties: { visao: { type: 'string', enum: ['diaria', 'semanal'] } },
      required: ['visao'],
      additionalProperties: false
    }
  },
  {
    name: 'frota',
    description:
      'Frota. visao "resumo": toneladas transportadas/carregadas hoje, ontem, semana e safra por tipo de equipamento e ' +
      'por proprietário, com litros de combustível e média l/t. visao "detalhe_equipamentos": toneladas por equipamento ' +
      'de um tipo (tipo T = transporte, C = carregamento; cod_tipo_equipamento vem do resumo). visao "disponibilidade": ' +
      'frota própria (caminhões, reboques, colhedoras, carregadeiras, tratores): quantidade por categoria e status ' +
      '(TRANSITO = operando normalmente, DESCARGA = dentro da fábrica, MANUTENCAO = na oficina) e a lista dos ' +
      'equipamentos em manutenção ou descarga, com ordem de serviço e desde quando. Use listar_todos=true só se ' +
      'precisar de cada equipamento, inclusive os que estão operando.',
    input_schema: {
      type: 'object',
      properties: {
        visao: { type: 'string', enum: ['resumo', 'detalhe_equipamentos', 'disponibilidade'] },
        tipo: { type: 'string', enum: ['T', 'C'] },
        cod_tipo_equipamento: { type: 'integer' },
        listar_todos: { type: 'boolean', description: 'Só na visão disponibilidade: true lista todos os equipamentos (padrão false)' }
      },
      required: ['visao'],
      additionalProperties: false
    }
  },
  {
    name: 'indicadores_laboratorio',
    description:
      'Indicadores industriais do laboratório (ontem, hoje e média da safra: ART, pol, ATR, fibra, geração de ' +
      'energia, pH, impurezas etc.) e moagem média por hora (hoje, ontem, safra).',
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'calcular',
    description:
      'Calculadora exata. Use SEMPRE que precisar de uma soma, diferença, média (inclusive ponderada), percentual ou ' +
      'qualquer conta que não venha pronta nos dados — nunca faça contas de cabeça. Envie uma ou mais expressões ' +
      'aritméticas com números (ponto como separador decimal, sem separador de milhar), + - * / e parênteses. ' +
      'Exemplo de média ponderada: "(127.0993*14199.88 + 126.4632*61.46) / (14199.88 + 61.46)".',
    input_schema: {
      type: 'object',
      properties: {
        expressoes: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 }
      },
      required: ['expressoes'],
      additionalProperties: false
    }
  }
];

// Nomes amigáveis exibidos na tela enquanto o assistente consulta
const ROTULOS = {
  resumo_agricola: 'resumo agrícola',
  entrada_cana_detalhada: 'entrada de cana por fazenda/variedade',
  planejamento_colheita: 'planejamento de colheita',
  painel_industria: 'status e paradas da indústria',
  producao_industrial: 'produção industrial',
  frota: 'frota',
  indicadores_laboratorio: 'indicadores do laboratório'
};

class ErroFerramenta extends Error {}

// Avaliador aritmético seguro (sem eval): números, + - * /, parênteses e sinal unário
function avaliar(expr) {
  const s = String(expr).replace(/\s+/g, '');
  if (!s || s.length > 500 || !/^[0-9+\-*/().]+$/.test(s)) throw new ErroFerramenta(`expressão inválida: ${expr}`);
  let i = 0;
  const erro = () => new ErroFerramenta(`expressão inválida: ${expr}`);
  function fator() {
    if (s[i] === '-') { i++; return -fator(); }
    if (s[i] === '+') { i++; return fator(); }
    if (s[i] === '(') {
      i++;
      const v = soma();
      if (s[i] !== ')') throw erro();
      i++;
      return v;
    }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) throw erro();
    i += m[0].length;
    return parseFloat(m[0]);
  }
  function produto() {
    let v = fator();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i++];
      const d = fator();
      if (op === '/' && d === 0) throw new ErroFerramenta(`divisão por zero em: ${expr}`);
      v = op === '*' ? v * d : v / d;
    }
    return v;
  }
  function soma() {
    let v = produto();
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++];
      const d = produto();
      v = op === '+' ? v + d : v - d;
    }
    return v;
  }
  const r = soma();
  if (i !== s.length || !isFinite(r)) throw erro();
  return Number(r.toFixed(6));
}

function exigirData(valor, campo) {
  if (!DATA.test(String(valor || ''))) throw new ErroFerramenta(`${campo} deve estar no formato dd/mm/aaaa`);
  return valor;
}

// Resposta de rota -> dados reais (recusa dados simulados ou erro)
function dadosDaRota({ status, body }) {
  if (status !== 200 || !body) throw new ErroFerramenta(`consulta indisponível (HTTP ${status})`);
  if (body.isLiveDb === false) {
    throw new ErroFerramenta('o banco de dados está indisponível no momento; não há dados reais para responder');
  }
  return body;
}

// Lista de objetos -> tabela compacta: os nomes das colunas aparecem uma vez só.
// campos: [nomeDaColuna, campoDeOrigem | função(objeto)]
function tab(lista, campos) {
  return {
    colunas: campos.map(c => c[0]),
    linhas: (lista || []).map(o => campos.map(([, origem]) => {
      const v = typeof origem === 'function' ? origem(o) : o[origem];
      return v === undefined || v === '' || v === '.' ? null : v;
    }))
  };
}

const QUALIDADE = [['pcc', 'pcc'], ['atr', 'atr'], ['ar', 'ar'], ['pureza', 'pureza'], ['fibra', 'fibra'], ['tq', 'tq']];
const RESUMO = [['periodo', 'periodo'], ['de', 'datini'], ['ate', 'datfin'], ['toneladas', 'pesliq'], ...QUALIDADE,
  ['imp_mineral', 'impmin'], ['imp_vegetal', 'impveg']];
const RESUMO_HOJE = RESUMO.filter(c => c[0] !== 'de' && c[0] !== 'ate'); // turnos e horas são sempre de hoje
const PLANEJAMENTO = [['lotes', 'lotes'], ['lotes_planejados', 'lotesPlanejados'], ['lotes_colhidos', 'lotesColhidos'],
  ['area_ha', 'area'], ['estimado_t', 'estimado'], ['planejado_t', 'planejado'], ['colhido_t', 'colhido'],
  ['fora_do_plano_t', 'foraPlano'], ['saldo_t', 'saldo'], ['pct_evolucao', 'pctEvolucao'], ['pct_cumprimento', 'pctCumprimento']];
const LOTE = [['lote', l => l.lote ?? l.id], ['data_prevista', 'dataPrevista'], ...PLANEJAMENTO.filter(c => !c[0].startsWith('lotes'))];
const NOME_MOENDA = { 3: 'A', 355: 'B' };

// Lotes: por padrão só os que têm plano até hoje ou colheita (a maioria dos lotes de uma fazenda não tem nenhum dos dois)
function lotesCompactos(lotes, todos) {
  const ativos = todos ? lotes : lotes.filter(l => l.planejado > 0 || l.colhido > 0);
  const resto = lotes.length - ativos.length;
  return {
    ...tab(ativos, LOTE),
    ...(resto > 0 ? { lotes_sem_plano_e_sem_colheita: { quantidade: resto, nota: 'omitidos; use incluir_lotes_sem_movimento=true para listá-los' } } : {})
  };
}

async function executar(nome, input = {}) {
  switch (nome) {
    case 'resumo_agricola': {
      const d = dadosDaRota(await chamarRota(rotas.agricola, '/'));
      // (o detalhe por fornecedor/variedade desta rota é de uma data fixa antiga: fica de fora)
      return {
        posicao: d.dathor,
        cana_total: tab(d.resumoTotal, RESUMO),
        cana_propria: tab(d.resumoPropria, RESUMO),
        cana_fornecedor: tab(d.resumoFornecedor, RESUMO),
        colhedora_mecanizada: tab(d.resumoColhedora, RESUMO),
        corte_manual: tab(d.resumoManual, RESUMO),
        turnos_hoje: tab(d.resumoTurnos, RESUMO_HOJE),
        horas_hoje: tab(d.resumoHoras, RESUMO_HOJE),
        mensal_e_por_tipo_de_fazenda: tab(d.resumoMensal, [['mes_ou_tipo', 'mes'], ['toneladas', 'pesliq'], ...QUALIDADE]),
        tch: d.rendimentoTch,
        planejamento_por_grupo: d.planejamentoColheita
          ? tab(d.planejamentoColheita, [['grupo', 'nome'], ...PLANEJAMENTO]) : null
      };
    }
    case 'entrada_cana_detalhada': {
      const query = {
        datini: exigirData(input.data_inicial, 'data_inicial'),
        datfin: exigirData(input.data_final, 'data_final'),
        horini: String(input.hora_inicial ?? 0),
        horfin: String(input.hora_final ?? 23),
        tipcol: input.tipo_colheita || 'T',
        tipo: String(input.tipo_fazenda ?? 0)
      };
      const d = dadosDaRota(await chamarRota(rotas.agricola, '/detalhe', query));
      const medidas = [['toneladas', 'pesliq'], ['brix', 'brix'], ['pcc', 'pcc'], ['fibra', 'fibra'], ['atr', 'atr'],
        ['ar', 'ar'], ['pureza', 'pureza'], ['tq', 'tq']];
      const linhas = (d.fornecedores || []).filter(f => f.tipo !== '2');
      const variedades = (d.variedades || []).filter(v => v.tipo !== '2');
      const ordem = medidas.find(m => m[0] === input.ordenar_por);
      if (ordem) {
        const decrescente = (a, b) => (Number(b[ordem[1]]) || 0) - (Number(a[ordem[1]]) || 0);
        linhas.sort(decrescente);
        variedades.sort(decrescente);
      }
      const total = (d.fornecedores || []).find(f => f.tipo === '2');
      return {
        periodo: { de: query.datini, ate: query.datfin, hora_inicial: +query.horini, hora_final: +query.horfin,
                   tipo_colheita: query.tipcol, tipo_fazenda: +query.tipo },
        ...(ordem ? { ordenado_por: `${ordem[0]} (maior para menor)` } : {}),
        por_fornecedor_fazenda_corte: tab(linhas, [['fornecedor', 'fornecedor'], ['fazenda', 'fazenda'], ['corte', 'tipocorte'], ...medidas]),
        total_geral: total ? tab([total], medidas) : null,
        por_variedade: tab(variedades,
          [['variedade', 'variedade'], ['pct_do_total', 'percentual'], ...medidas])
      };
    }
    case 'planejamento_colheita': {
      const todos = input.incluir_lotes_sem_movimento === true;
      if (input.nome_fazenda) {
        const rows = await oracle.executeQuery(queries.agricola.planejamentoColheita(config.safra));
        if (!rows) throw new ErroFerramenta('dados de planejamento indisponíveis');
        const encontradas = planejamento.buscarFazenda(rows, input.nome_fazenda);
        if (!encontradas.length) return { fazendas: [], aviso: 'nenhuma fazenda com esse nome' };
        return {
          fazendas: encontradas.map(f => ({
            fazenda: f.fazenda, cod_fazenda: f.codFazenda, fornecedor: f.fornecedor, cod_fornecedor: f.codFornecedor, grupo: f.grupo,
            totais: tab([f], PLANEJAMENTO),
            lotes: lotesCompactos(f.lotesDetalhe, todos)
          }))
        };
      }
      const query = { grupo: String(input.grupo ?? 0) };
      if (input.cod_fornecedor != null) query.fornecedor = String(input.cod_fornecedor);
      if (input.cod_fazenda != null) {
        if (input.cod_fornecedor == null) throw new ErroFerramenta('cod_fazenda exige cod_fornecedor');
        query.fazenda = String(input.cod_fazenda);
      }
      const d = dadosDaRota(await chamarRota(rotas.agricola, '/planejamento', query));
      const base = { nivel: d.nivel, caminho: (d.caminho || []).map(c => c.nome).join(' > '), total: tab([d.total], PLANEJAMENTO) };
      if (d.nivel === 'lotes') return { ...base, lotes: lotesCompactos(d.itens, todos) };
      const cols = [['codigo', 'id'], ['nome', 'nome'], ...(d.nivel === 'fornecedores' ? [['grupo', 'grupo']] : []), ...PLANEJAMENTO];
      return { ...base, itens: tab(d.itens, cols) };
    }
    case 'painel_industria': {
      const d = dadosDaRota(await chamarRota(rotas.industria, '/'));
      const dias = Math.min(15, Math.max(1, parseInt(input.dias_paradas, 10) || 7));
      const limite = new Date(Date.now() - dias * 86400000);
      const dataDe = (txt) => { const [dd, mm, aa] = String(txt).split('/'); return new Date(+aa, +mm - 1, +dd, 23, 59); };
      const recentes = (d.paradas || []).filter(p => dataDe(p.datmov) >= limite);
      const moenda = (o) => NOME_MOENDA[o.codObjeto] || o.codObjeto;
      return {
        posicao: d.dathor,
        moendas: tab(d.moendas, [['moenda', 'nome'], ['status', 'status'], ['motivo', 'motivo'], ['data', 'dataHora'],
          ['inicio', 'horaIni'], ['tempo', 'tempo']]),
        paradas_por_causa: d.paradasPorCausa
          ? tab(d.paradasPorCausa, [['moenda', moenda], ['causa', 'causa'], ['min_hoje', 'minHoje'], ['min_ontem', 'minOntem'],
            ['min_safra', 'minSafra'], ['paradas_safra', 'qtdSafra']])
          : null,
        paradas_recentes: { dias, ...tab(recentes, [['moenda', moenda], ['data', 'datmov'], ['inicio', 'horaIni'], ['fim', 'horaFim'],
          ['duracao', 'tempoParada'], ['causa', 'causa'], ['observacao', 'observacao']]) }
      };
    }
    case 'producao_industrial': {
      const semanal = input.visao === 'semanal';
      const d = dadosDaRota(await chamarRota(rotas.producao, semanal ? '/semanal' : '/'));
      const medidas = [['cana_entrada_t', 'canaEntrada'], ['cana_moida_t', 'canaMoida'], ['eficiencia', 'eficiencia'], ...QUALIDADE,
        ['prod_equivalente', 'prodEquiv'], ['hidratado', 'prodHidratado'], ['anidro', 'prodAnidro'], ['acucar', 'prodAcucar']];
      const unidades = 'cana em toneladas; hidratado e anidro em litros; acucar em sacos de 50 kg; ' +
        'prod_equivalente = produção equivalente (unidade não confirmada: informe o número sem unidade)';
      if (semanal) return { posicao: d.dathor, unidades, semanas: tab(d.semanas, [['semana', 'sem'], ['periodo', 'periodo'], ...medidas]) };
      // As três produções horárias de hoje numa tabela só (uma linha por hora)
      const porHora = {};
      for (const [chave, lista] of [['hid', d.horarioHidratado], ['ani', d.horarioAnidro], ['acu', d.horarioAcucar]]) {
        for (const h of lista || []) (porHora[h.hora] ??= { hora: (h.descricao || h.hora).replace(/\s+/g, ' ').trim() })[chave] = h;
      }
      const produto = (rot, k) => [[`${rot}_producao`, h => h[k]?.producao ?? null], [`${rot}_saida`, h => h[k]?.saida ?? null],
        [`${rot}_carros`, h => h[k]?.qtdCarros ?? null]];
      return {
        posicao: d.dathor,
        unidades,
        historico_diario: tab(d.historicoDiario, [['dia', 'datmov'], ...medidas]),
        producao_por_hora_hoje: tab(Object.values(porHora), [['hora', 'hora'], ...produto('hidratado', 'hid'), ...produto('anidro', 'ani'), ...produto('acucar', 'acu')]),
        acucar_total_safra: d.totaisSafra
      };
    }
    case 'frota': {
      if (input.visao === 'disponibilidade') {
        // A rota repete cada equipamento na categoria e em "todos": usa só a lista única.
        // Por padrão lista só quem NÃO está em situação normal (em trânsito); o resto vai resumido em contagens.
        const d = dadosDaRota(await chamarRota(rotas.frota, '/disponibilidade'));
        const todos = d.todos || [];
        const contagem = {};
        for (const e of todos) ((contagem[e.categoria] ??= {})[e.status] = (contagem[e.categoria][e.status] || 0) + 1);
        const lista = input.listar_todos === true ? todos : todos.filter(e => e.status !== 'TRANSITO');
        return {
          posicao: d.dathor,
          kpis: d.kpis,
          quantidade_por_categoria_e_status: contagem,
          equipamentos: {
            ...(input.listar_todos === true ? {} : { nota: 'somente equipamentos em manutenção ou em descarga; use listar_todos=true para a lista completa' }),
            ...tab(lista, [['categoria', 'categoria'], ['tipo', 'descTipoEquipamento'], ['codigo', 'codEquipamento'], ['descricao', 'descricao'],
              ['status', 'status'], ['ordem_servico', 'ordemServico'], ['os_revisao', 'ordemServicoRevisao'], ['na_oficina_desde', 'oficinaDataHora']])
          }
        };
      }
      const valores = [['hoje_t', 'hoje'], ['ontem_t', 'ontem'], ['semana_t', 'semana'], ['safra_t', 'safra']];
      if (input.visao === 'detalhe_equipamentos') {
        if (input.cod_tipo_equipamento == null) throw new ErroFerramenta('informe cod_tipo_equipamento (veja a visão resumo)');
        const d = dadosDaRota(await chamarRota(rotas.frota, '/detalhe', {
          tipo: input.tipo === 'C' ? 'C' : 'T',
          codigo: String(input.cod_tipo_equipamento)
        }));
        const eq = d.equipamentos || [];
        return { tipo: eq[0] ? eq[0].tipoDescricao : null, equipamentos: tab(eq, [['codigo', 'codEquipamento'], ['descricao', 'descricao'], ...valores]) };
      }
      const d = dadosDaRota(await chamarRota(rotas.frota, '/'));
      const consumo = [...valores, ['litros', 'litros'], ['media_l_por_t', 'media']];
      return {
        posicao: d.dathor,
        transporte_por_tipo: tab(d.transportePorTipo, [['cod_tipo_equipamento', 'codTipoEquipamento'], ['tipo', 'descricao'], ...consumo]),
        carregamento_por_tipo: tab(d.carregamentoPorTipo, [['cod_tipo_equipamento', 'codTipoEquipamento'], ['tipo', 'descricao'], ...consumo]),
        transporte_por_proprietario: tab(d.transportePorProprietario, [['proprietario', 'nome'], ...consumo])
      };
    }
    case 'indicadores_laboratorio': {
      const d = dadosDaRota(await chamarRota(rotas.laboratorio, '/'));
      return {
        posicao: d.dathor,
        indicadores: tab(d.cards, [['indicador', 'titulo'], ['unidade', 'unidade'], ['ontem', 'ontem'], ['hoje', 'hoje'],
          ['safra', 'safra'], ['referencia', 'refTexto'], ['situacao', 'status']])
      };
    }
    case 'calcular': {
      if (!Array.isArray(input.expressoes) || input.expressoes.length === 0 || input.expressoes.length > 20) {
        throw new ErroFerramenta('envie de 1 a 20 expressões');
      }
      return input.expressoes.map(e => ({ expressao: e, resultado: avaliar(e) }));
    }
    default:
      throw new ErroFerramenta(`ferramenta desconhecida: ${nome}`);
  }
}

// Executa e devolve o conteúdo de tool_result (texto JSON compacto) + se houve erro
async function executarParaModelo(nome, input) {
  try {
    let texto = JSON.stringify(await executar(nome, input));
    if (texto.length > MAX_CARACTERES) {
      texto = texto.slice(0, MAX_CARACTERES) + '… [resultado cortado por tamanho; refine o filtro]';
    }
    return { content: texto, is_error: false };
  } catch (err) {
    const msg = err instanceof ErroFerramenta ? err.message : 'falha ao consultar os dados';
    if (!(err instanceof ErroFerramenta)) console.error(`Assistente: erro na ferramenta ${nome}:`, err.message);
    return { content: msg, is_error: true };
  }
}

module.exports = { DEFINICOES, ROTULOS, executarParaModelo, avaliar };
