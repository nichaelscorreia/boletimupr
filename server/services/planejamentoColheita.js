// KPIs de planejamento x realizado da colheita (consulta agricola.planejamentoColheita, uma linha por lote).
//
// Memória de cálculo (por lote, somada em cada nível):
//   estimado   = toneladas estimadas do lote (TCH estimado x área)
//   planejado  = toneladas planejadas com data <= hoje
//   colhido    = toneladas que entraram na balança na safra (independente do plano)
//   aderente   = min(colhido, planejado)  -> parte do plano que foi de fato cumprida
//   foraPlano  = colhido - aderente       -> colhido além do planejado até hoje (lote adiantado ou fora do plano)
//   saldo      = estimado - colhido
//   % evolução    = colhido / estimado
//   % cumprimento = aderente / planejado  (null quando não há planejamento até hoje)
//
// O cumprimento usa min() por lote para que colher um lote não planejado não "compense" um lote planejado
// que ficou para trás; esse volume aparece separado em foraPlano.

const GRUPOS = [
  { id: 1, nome: 'Cana Própria' },
  { id: 2, nome: 'Cana Acionistas' },
  { id: 3, nome: 'Cana Triunfo' },
  { id: 4, nome: 'Cana Sinimbú' },
  { id: 5, nome: 'Cana Fornecedores' }
];
const GRUPO_TOTAL = { id: 0, nome: 'Cana Total' };

const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const round = (v, d = 2) => Number(v.toFixed(d));

// DATA_PREVISTA_COLHEITA chega como "2026-09-19 00:00:00.0"
function formatDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function toLote(r) {
  const planejado = num(r.TONELADAS_PLANEJADAS);
  const colhido = num(r.TONELADAS_COLHIDAS);
  return {
    grupo: parseInt(r.COD_TIPOPROPRIETARIO, 10),
    codFornecedor: parseInt(r.COD_FORNECEDOR, 10),
    fornecedor: (r.NOMEFORNECEDOR || '').trim() || `Fornecedor ${r.COD_FORNECEDOR}`,
    codFazenda: parseInt(r.COD_FAZENDA, 10),
    fazenda: (r.FAZENDA || '').trim(),
    lote: r.COD_TALHAO,
    area: num(r.AREAPRODUCAO),
    tchEstimado: num(r.TCH_ESTIMADO),
    estimado: num(r.TONELADAS_ESTIMADAS),
    planejado,
    colhido,
    aderente: Math.min(colhido, planejado),
    dataPrevista: formatDate(r.DATA_PREVISTA_COLHEITA)
  };
}

function metricas(lotes) {
  const s = { area: 0, estimado: 0, planejado: 0, colhido: 0, aderente: 0, lotesPlanejados: 0, lotesColhidos: 0 };
  for (const l of lotes) {
    s.area += l.area;
    s.estimado += l.estimado;
    s.planejado += l.planejado;
    s.colhido += l.colhido;
    s.aderente += l.aderente;
    if (l.planejado > 0) s.lotesPlanejados++;
    if (l.colhido > 0) s.lotesColhidos++;
  }
  return {
    lotes: lotes.length,
    lotesPlanejados: s.lotesPlanejados,
    lotesColhidos: s.lotesColhidos,
    area: round(s.area),
    estimado: round(s.estimado, 3),
    planejado: round(s.planejado, 3),
    colhido: round(s.colhido, 3),
    aderente: round(s.aderente, 3),
    foraPlano: round(s.colhido - s.aderente, 3),
    saldo: round(s.estimado - s.colhido, 3),
    pctEvolucao: s.estimado > 0 ? round((s.colhido / s.estimado) * 100) : null,
    pctCumprimento: s.planejado > 0 ? round((s.aderente / s.planejado) * 100) : null
  };
}

function agrupar(lotes, chave) {
  const mapa = new Map();
  for (const l of lotes) {
    const k = chave(l);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(l);
  }
  return mapa;
}

// Cards: Total + cada grupo na ordem fixa (grupos sem lotes aparecem zerados)
function resumoGrupos(rows) {
  const lotes = rows.map(toLote);
  const porGrupo = agrupar(lotes, l => l.grupo);
  return [
    { ...GRUPO_TOTAL, ...metricas(lotes) },
    ...GRUPOS.map(g => ({ ...g, ...metricas(porGrupo.get(g.id) || []) }))
  ];
}

/**
 * Detalhamento: grupo -> fornecedores -> fazendas -> lotes.
 * grupo 0 (Cana Total) lista os fornecedores de todos os grupos.
 */
function detalhe(rows, { grupo, fornecedor, fazenda }) {
  const infoGrupo = grupo === 0 ? GRUPO_TOTAL : GRUPOS.find(g => g.id === grupo);
  if (!infoGrupo) return null;

  let lotes = rows.map(toLote);
  if (grupo !== 0) lotes = lotes.filter(l => l.grupo === grupo);
  const caminho = [{ nivel: 'grupo', id: infoGrupo.id, nome: infoGrupo.nome }];

  if (fornecedor == null) {
    const itens = [...agrupar(lotes, l => l.codFornecedor).values()].map(ls => ({
      id: ls[0].codFornecedor,
      nome: ls[0].fornecedor,
      grupo: GRUPOS.find(g => g.id === ls[0].grupo)?.nome,
      ...metricas(ls)
    }));
    return { nivel: 'fornecedores', caminho, total: metricas(lotes), itens: ordenar(itens) };
  }

  lotes = lotes.filter(l => l.codFornecedor === fornecedor);
  if (lotes.length === 0) return { nivel: 'fazendas', caminho, total: metricas([]), itens: [] };
  caminho.push({ nivel: 'fornecedor', id: fornecedor, nome: lotes[0].fornecedor });

  if (fazenda == null) {
    const itens = [...agrupar(lotes, l => l.codFazenda).values()].map(ls => ({
      id: ls[0].codFazenda,
      nome: ls[0].fazenda,
      ...metricas(ls)
    }));
    return { nivel: 'fazendas', caminho, total: metricas(lotes), itens: ordenar(itens) };
  }

  lotes = lotes.filter(l => l.codFazenda === fazenda);
  if (lotes.length === 0) return { nivel: 'lotes', caminho, total: metricas([]), itens: [] };
  caminho.push({ nivel: 'fazenda', id: fazenda, nome: lotes[0].fazenda });

  const itens = lotes.map(l => ({
    id: l.lote,
    nome: `Lote ${l.lote}`,
    tchEstimado: round(l.tchEstimado),
    dataPrevista: l.dataPrevista,
    ...metricas([l])
  }));
  // Lotes: primeiro os que têm plano até hoje (por data prevista), depois os colhidos fora do plano, depois o resto
  itens.sort((a, b) =>
    (b.planejado > 0) - (a.planejado > 0) ||
    dataOrdem(a.dataPrevista) - dataOrdem(b.dataPrevista) ||
    b.colhido - a.colhido ||
    String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true }));
  return { nivel: 'lotes', caminho, total: metricas(lotes), itens };
}

function dataOrdem(d) {
  if (!d) return Number.MAX_SAFE_INTEGER;
  const [dd, mm, yyyy] = d.split('/');
  return Number(yyyy + mm + dd);
}

// Maior planejado primeiro; empate (ex.: sem plano) pelo colhido e depois pelo estimado
function ordenar(itens) {
  return itens.sort((a, b) => b.planejado - a.planejado || b.colhido - a.colhido || b.estimado - a.estimado);
}

module.exports = { resumoGrupos, detalhe };
