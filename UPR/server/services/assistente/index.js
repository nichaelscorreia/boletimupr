// Assistente de dados do painel (Claude + tool use). Responde perguntas sobre os dados da UPR consultando
// as mesmas rotas das telas; nunca escreve nada.
const crypto = require('crypto');
const AnthropicSDK = require('@anthropic-ai/sdk');
const config = require('../../config');
const oracle = require('../../db/oracle');
const queries = require('../../db/queries');
const { DEFINICOES, ROTULOS, executarParaModelo } = require('./ferramentas');

const Anthropic = AnthropicSDK.default || AnthropicSDK;

const MAX_ITERACOES = 8;         // chamadas ao modelo por pergunta (consultas encadeadas)
const MAX_TURNOS = 15;           // perguntas por conversa
const CONVERSA_EXPIRA_MS = 60 * 60 * 1000;

// Instruções fixas (sem data/hora: faz parte do prefixo em cache)
const INSTRUCOES = `Você é o assistente de dados do Boletim Online de Moagem da Usina Porto Rico (UPR), uma usina sucroalcooleira em Alagoas. Gestores e operadores perguntam, por texto ou voz, sobre os dados exibidos no painel: entrada de cana, qualidade da matéria-prima, planejamento de colheita, indústria, produção, frota e laboratório.

Regras de precisão:
- Responda somente com dados obtidos pelas ferramentas nesta conversa. Nunca invente, estime ou arredonde números além do que os dados permitem.
- Se a pergunta não puder ser respondida com as ferramentas disponíveis, ou a ferramenta devolver erro ou vazio, diga isso claramente e, se fizer sentido, sugira uma pergunta próxima que você consegue responder.
- Sempre deixe claro o período (datas) e a unidade de cada número.
- Quando a pergunta for ambígua quanto ao período, use o mais natural (ex.: "hoje", "safra") e diga qual usou.
- Em rankings (ex.: melhor ATR), peça os dados já ordenados (ordenar_por), confira a ordem antes de escrever, ignore linhas de TOTAL, informe também a tonelagem de cada item e alerte quando um destaque tiver volume muito pequeno.
- Para totais de uma fazenda ou fornecedor que aparecem em mais de uma linha (ex.: corte manual e mecanizado), some as toneladas e, para indicadores de qualidade, use a média ponderada pelas toneladas.
- Toda conta que não venha pronta nos dados (soma, diferença, média, percentual) deve ser feita com a ferramenta calcular, nunca de cabeça. Só informe um número calculado depois de obtê-lo pela ferramenta; não escreva valores aproximados ("cerca de", "aproximadamente") somados de cabeça.

Formato dos dados das ferramentas:
- As listas vêm como tabelas compactas: "colunas" traz os nomes, na ordem, e cada item de "linhas" é uma linha com os valores na mesma ordem. Leia sempre o valor pela posição da coluna correspondente; null significa sem dado.
- Sufixo _t = toneladas; pct_ = percentual; min_ = minutos.

Glossário:
- Toneladas de cana = peso líquido entregue na balança (t). Hoje/Ontem = dia de movimento; Semana = de segunda-feira até hoje; Sem.Ant = semana anterior; Safra = desde o início da safra; Média/Dia = média diária da safra; Estimativa = projeção do dia pelo ritmo atual.
- ATR (kg/t), PCC = pol da cana (%), Brix (%), Fibra (%), Pureza (%), AR = açúcares redutores (%), TQ = tempo entre a queima e a entrega (h), Impureza vegetal e mineral (kg/t), TCH = toneladas de cana por hectare.
- Tipos de corte: COLHEDORA / mecanizado e MANUAL. Grupos de cana: Própria (da usina), Acionistas, Triunfo, Sinimbú e Fornecedores; Cana Total é a soma.
- Produção industrial (histórico diário e semanal): etanol hidratado e anidro em litros; açúcar em sacos de 50 kg; produção equivalente = os três produtos (anidro, hidratado e açúcar) convertidos em sacos de açúcar.
- Planejamento: planejado = volume programado até hoje; % evolução = colhido ÷ estimado da safra; % cumprimento = colhido ÷ planejado (pode passar de 100%); fora do plano = colhido além do programado para o lote.
- Datas sempre no formato dd/mm/aaaa ao chamar ferramentas.

Forma da resposta:
- Português do Brasil, direto e curto (as respostas podem ser lidas em voz alta). Comece pela resposta; depois, só o contexto essencial.
- Números no padrão brasileiro (1.234,5). Toneladas com até 1 casa decimal; percentuais e indicadores de qualidade com 2 casas.
- Use uma tabela Markdown pequena só quando comparar vários itens (no máximo 10 linhas).`;

let cliente = null;
function obterCliente() {
  if (!cliente) cliente = new Anthropic({ apiKey: config.assistente.apiKey, timeout: 120000, maxRetries: 2 });
  return cliente;
}

// ---- Contexto da pergunta (data/hora local e início da safra) ----

let inicioSafraCache = { valor: null, em: 0 };
async function inicioSafra() {
  if (config.inicioSafra) return config.inicioSafra;
  if (inicioSafraCache.valor && Date.now() - inicioSafraCache.em < 6 * 3600 * 1000) return inicioSafraCache.valor;
  const rows = await oracle.executeQuery(queries.agricola.resumoCompleto(config.safra));
  const linha = (rows || []).find(r => r.TIPO === '0' && (r.PERIODO || '').trim().toLowerCase() === 'safra');
  if (linha && linha.DATINI) inicioSafraCache = { valor: linha.DATINI, em: Date.now() };
  return inicioSafraCache.valor;
}

function agoraLocal() {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Maceio', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', weekday: 'long'
  });
  return fmt.format(new Date());
}

async function contexto() {
  const inicio = await inicioSafra().catch(() => null);
  return `[Contexto: agora é ${agoraLocal()} (horário de Alagoas). Safra atual: ${config.safra}` +
    `${inicio ? `, iniciada em ${inicio}` : ''}.]`;
}

// ---- Conversas (em memória, por dispositivo) ----

const conversas = new Map(); // id -> { dono, messages, turnos, atualizada, encerrada }

function limparConversas() {
  const agora = Date.now();
  for (const [id, c] of conversas) if (agora - c.atualizada > CONVERSA_EXPIRA_MS) conversas.delete(id);
}

function obterConversa(id, dono) {
  limparConversas();
  const c = id && conversas.get(id);
  if (c && c.dono === dono && !c.encerrada && c.turnos < MAX_TURNOS) return { id, conversa: c };
  const novoId = crypto.randomUUID();
  const nova = { dono, messages: [], turnos: 0, atualizada: Date.now(), encerrada: false };
  conversas.set(novoId, nova);
  return { id: novoId, conversa: nova, nova: true };
}

// ---- Limites de uso ----

const usoPorDono = new Map(); // dono -> [timestamps]
let usoDia = { dia: '', total: 0 };

function verificarLimites(dono) {
  const agora = Date.now();
  const hoje = new Date().toISOString().slice(0, 10);
  if (usoDia.dia !== hoje) usoDia = { dia: hoje, total: 0 };
  if (usoDia.total >= config.assistente.limiteDia) return 'Limite diário de perguntas do painel atingido. Tente amanhã.';
  const lista = (usoPorDono.get(dono) || []).filter(t => agora - t < 3600 * 1000);
  if (lista.length >= config.assistente.limiteHora) {
    return 'Você atingiu o limite de perguntas por hora deste dispositivo. Tente daqui a pouco.';
  }
  lista.push(agora);
  usoPorDono.set(dono, lista);
  usoDia.total++;
  return null;
}

// ---- Ciclo pergunta -> consultas -> resposta ----

function textoDe(content) {
  return content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}

async function perguntar({ pergunta, conversaId, dono }) {
  const limite = verificarLimites(dono);
  if (limite) return { erro: limite, status: 429 };

  const { id, conversa } = obterConversa(conversaId, dono);
  if (conversa.ocupada) return { erro: 'Aguarde a resposta da pergunta anterior.', status: 409 };
  conversa.ocupada = true;
  conversa.turnos++;
  conversa.atualizada = Date.now();
  conversa.messages.push({ role: 'user', content: `${await contexto()}\n\n${pergunta}` });

  const consultas = [];
  const uso = { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  const t0 = Date.now();

  try {
    for (let i = 0; i < MAX_ITERACOES; i++) {
      const resp = await obterCliente().beta.messages.create({
        model: config.assistente.modelo,
        max_tokens: 16000,
        output_config: { effort: config.assistente.esforco },
        // Se o modelo principal recusar, a própria API tenta o modelo de reserva adequado
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        cache_control: { type: 'ephemeral' },
        // Ponto de cache próprio: ferramentas + instruções são reaproveitadas entre conversas diferentes
        system: [{ type: 'text', text: INSTRUCOES, cache_control: { type: 'ephemeral' } }],
        tools: DEFINICOES,
        messages: conversa.messages
      });

      if (process.env.ASSISTENTE_DEBUG) {
        console.log(`   · chamada ${i + 1}: entrada=${resp.usage.input_tokens} saída=${resp.usage.output_tokens} ` +
          `cache lido=${resp.usage.cache_read_input_tokens} cache gravado=${resp.usage.cache_creation_input_tokens} fim=${resp.stop_reason}`);
      }
      uso.entrada += resp.usage.input_tokens || 0;
      uso.saida += resp.usage.output_tokens || 0;
      uso.cacheLeitura += resp.usage.cache_read_input_tokens || 0;
      uso.cacheEscrita += resp.usage.cache_creation_input_tokens || 0;

      // Histórico só cresce (nada é editado): mantém válidos os blocos de raciocínio do modelo
      conversa.messages.push({ role: 'assistant', content: resp.content });

      if (resp.stop_reason === 'refusal') {
        conversa.encerrada = true;
        return { conversaId: id, resposta: 'Não posso responder a essa pergunta. Inicie uma nova conversa para continuar.', consultas, uso };
      }

      if (resp.stop_reason === 'tool_use') {
        const chamadas = resp.content.filter(b => b.type === 'tool_use');
        const resultados = await Promise.all(chamadas.map(async (c) => {
          if (ROTULOS[c.name]) consultas.push(ROTULOS[c.name]); // "calcular" não é fonte de dados
          const r = await executarParaModelo(c.name, c.input);
          return { type: 'tool_result', tool_use_id: c.id, content: r.content, is_error: r.is_error };
        }));
        conversa.messages.push({ role: 'user', content: resultados });
        continue;
      }

      let resposta = textoDe(resp.content);
      if (resp.stop_reason === 'max_tokens') resposta += '\n\n_(resposta interrompida por tamanho)_';
      return { conversaId: id, resposta: resposta || 'Não consegui formular uma resposta.', consultas, uso };
    }
    conversa.encerrada = true;
    return {
      conversaId: id,
      resposta: 'A pergunta exigiu consultas demais. Tente uma pergunta mais específica (período, fazenda ou indicador).',
      consultas, uso
    };
  } catch (err) {
    // Leva junto o que já foi consumido, para o registro da pergunta
    const falha = (erro, status) => ({ erro, status, conversaId: id, consultas, uso });
    conversa.encerrada = true; // histórico pode ter ficado incompleto: a próxima pergunta abre conversa nova
    if (err instanceof Anthropic.RateLimitError) return falha('Assistente ocupado no momento. Tente em instantes.', 503);
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('Assistente: chave da API do Claude inválida');
      return falha('Assistente não configurado corretamente.', 503);
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`Assistente: erro da API do Claude ${err.status}: ${err.message}`);
      return falha('O assistente não conseguiu responder agora. Tente novamente.', 502);
    }
    console.error('Assistente: erro inesperado:', err);
    return falha('O assistente não conseguiu responder agora. Tente novamente.', 500);
  } finally {
    conversa.ocupada = false;
    console.log(`🤖 Assistente: ${((Date.now() - t0) / 1000).toFixed(1)}s, consultas=[${consultas.join(', ')}], ` +
      `tokens entrada=${uso.entrada} saída=${uso.saida} cache lido=${uso.cacheLeitura} cache gravado=${uso.cacheEscrita}`);
  }
}

function encerrarConversa(id, dono) {
  const c = conversas.get(id);
  if (c && c.dono === dono) conversas.delete(id);
}

const ativo = () => !!config.assistente.apiKey;

module.exports = { perguntar, encerrarConversa, ativo };
