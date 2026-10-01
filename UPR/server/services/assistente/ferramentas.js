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
      'fazenda com PCC/ATR/AR/fibra/pureza/TQ; TCH previsto x realizado; e os cards de planejamento de colheita por ' +
      'grupo (Cana Total, Própria, Acionistas, Triunfo, Sinimbú, Fornecedores) com planejado, colhido, saldo, % evolução ' +
      'e % cumprimento. Use para perguntas gerais de moagem/entrada de cana por período padrão.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'entrada_cana_detalhada',
    description:
      'Entrada de cana num intervalo de datas e horas QUALQUER, detalhada por fornecedor + fazenda + tipo de corte ' +
      '(toneladas, Brix, PCC, Fibra, ATR, AR, Pureza, tempo de queima) e por variedade de cana. A linha com ' +
      'tipo "2" é o TOTAL GERAL do período. Use para: produção/entrada de cana de uma fazenda ou fornecedor num dia, ' +
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
        tipo_fazenda: { type: 'integer', enum: [0, 1, 2, 3], description: '0 = todos; 1, 2 ou 3 filtram o tipo de fazenda' }
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
      'use nome_fazenda (traz a fazenda e os seus lotes).',
    input_schema: {
      type: 'object',
      properties: {
        grupo: { type: 'integer', enum: [0, 1, 2, 3, 4, 5] },
        cod_fornecedor: { type: 'integer' },
        cod_fazenda: { type: 'integer' },
        nome_fazenda: { type: 'string', description: 'Parte do nome da fazenda (sem distinção de acento/maiúsculas)' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'painel_industria',
    description:
      'Status atual das moendas (A e B: rodando/parada, motivo, desde quando), horas paradas por causa em cada moenda ' +
      '(minutos hoje, ontem e na safra, com quantidade de paradas) e lista das paradas dos últimos 15 dias com ' +
      'horário, duração, causa e observação.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
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
      'situação de cada equipamento da frota própria (caminhões, reboques, colhedoras, carregadeiras, tratores): na ' +
      'oficina, ordem de serviço aberta, dentro da fábrica.',
    input_schema: {
      type: 'object',
      properties: {
        visao: { type: 'string', enum: ['resumo', 'detalhe_equipamentos', 'disponibilidade'] },
        tipo: { type: 'string', enum: ['T', 'C'] },
        cod_tipo_equipamento: { type: 'integer' }
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

async function executar(nome, input = {}) {
  switch (nome) {
    case 'resumo_agricola': {
      const d = dadosDaRota(await chamarRota(rotas.agricola, '/'));
      // O detalhe por fornecedor/variedade desta rota é de uma data fixa antiga: fica de fora para não confundir
      const { detalheFornecedores, detalheVariedades, ...resto } = d;
      return resto;
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
      return { periodo: d.meta, fornecedores_fazendas: d.fornecedores, variedades: d.variedades };
    }
    case 'planejamento_colheita': {
      if (input.nome_fazenda) {
        const rows = await oracle.executeQuery(queries.agricola.planejamentoColheita(config.safra));
        if (!rows) throw new ErroFerramenta('dados de planejamento indisponíveis');
        const encontradas = planejamento.buscarFazenda(rows, input.nome_fazenda);
        return encontradas.length ? { fazendas: encontradas } : { fazendas: [], aviso: 'nenhuma fazenda com esse nome' };
      }
      const query = { grupo: String(input.grupo ?? 0) };
      if (input.cod_fornecedor != null) query.fornecedor = String(input.cod_fornecedor);
      if (input.cod_fazenda != null) {
        if (input.cod_fornecedor == null) throw new ErroFerramenta('cod_fazenda exige cod_fornecedor');
        query.fazenda = String(input.cod_fazenda);
      }
      return dadosDaRota(await chamarRota(rotas.agricola, '/planejamento', query));
    }
    case 'painel_industria':
      return dadosDaRota(await chamarRota(rotas.industria, '/'));
    case 'producao_industrial':
      return dadosDaRota(await chamarRota(rotas.producao, input.visao === 'semanal' ? '/semanal' : '/'));
    case 'frota': {
      if (input.visao === 'disponibilidade') {
        // A rota repete cada equipamento na categoria e em "todos": envia só a lista única, em formato de tabela
        const d = dadosDaRota(await chamarRota(rotas.frota, '/disponibilidade'));
        return {
          dathor: d.dathor,
          kpis: d.kpis,
          colunas: ['categoria', 'tipo', 'codigo', 'descricao', 'status', 'dentro_do_patio', 'ordem_servico', 'os_revisao', 'na_oficina_desde'],
          equipamentos: (d.todos || []).map(e => [e.categoria, e.descTipoEquipamento, e.codEquipamento, e.descricao,
            e.status, e.dentroPatio ? 'S' : 'N', e.ordemServico, e.ordemServicoRevisao, e.oficinaDataHora])
        };
      }
      if (input.visao === 'detalhe_equipamentos') {
        if (input.cod_tipo_equipamento == null) throw new ErroFerramenta('informe cod_tipo_equipamento (veja a visão resumo)');
        return dadosDaRota(await chamarRota(rotas.frota, '/detalhe', {
          tipo: input.tipo === 'C' ? 'C' : 'T',
          codigo: String(input.cod_tipo_equipamento)
        }));
      }
      return dadosDaRota(await chamarRota(rotas.frota, '/'));
    }
    case 'indicadores_laboratorio':
      return dadosDaRota(await chamarRota(rotas.laboratorio, '/'));
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
