// View do Módulo Agrícola (Boletim Online de Moagem 2.0)
// Exibe dados 100% reais do banco Oracle (Safra 54) com drilldown interativo

const AgricolaView = {
  currentData: null,
  selectedPeriod: {
    tipo: '0',
    tipo2: '1',
    periodo: 'Hoje',
    datini: '19/09/2026',
    datfin: '19/09/2026',
    horini: 0,
    horfin: 23
  },

  async render(container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
        <div class="live-dot" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
        <p>Sincronizando dados agrícolas e balança de cana em tempo real...</p>
      </div>
    `;

    const data = await API.getAgricola();
    if (!data || !data.success) {
      container.innerHTML = '<div class="section-card"><p style="color: var(--accent-rose); padding: 2rem; text-align: center;">Erro ao carregar dados agrícolas do banco de dados.</p></div>';
      return;
    }

    this.currentData = data;
    const { dathor, resumoTotal = [], resumoPropria = [], resumoFornecedor = [], resumoColhedora = [], resumoManual = [], rendimentoTch: tch, planejamentoColheita, resumoMensal = [], detalheFornecedores = [], detalheVariedades = [] } = data;

    // Encontrar linha da Safra para dados de qualidade padrão caso Média/Dia venha sem PCC
    const safraTotalRow = resumoTotal.find(r => r.periodo.toLowerCase().includes('safra')) || {};

    // Distribuição mecanizado x manual: base = mecanizado + manual do mesmo período
    // (igual ao total em todos os períodos; na Média/Dia garante que as duas fatias somem 100%)
    const baseCorte = {};
    [...resumoColhedora, ...resumoManual].forEach(r => {
      baseCorte[r.periodo] = (baseCorte[r.periodo] || 0) + (r.pesliq || 0);
    });
    const pctCorte = (r) => baseCorte[r.periodo] > 0 ? `${this.fmt((r.pesliq || 0) / baseCorte[r.periodo] * 100, 1)}%` : '-';

    const html = `
      <!-- LINHA ÚNICA DOS INDICADORES (KPIs) -->
      <style>
        .agricola-kpi-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .agricola-kpi-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .agricola-kpi-label {
          font-size: 0.65rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          margin-bottom: 0.2rem;
          font-weight: 600;
        }
        .agricola-kpi-val {
          font-size: 0.9rem;
          font-weight: 700;
        }
        .agricola-kpi-row-2 {
          display: flex;
          gap: 1.5rem;
        }
        .data-table th, .data-table td {
          padding: 0.4rem 0.2rem !important;
          font-size: 0.72rem !important;
        }
        @media (min-width: 769px) {
          .data-table th, .data-table td {
            padding: 0.5rem 0.4rem !important;
            font-size: 0.85rem !important;
          }
        }
        @media (min-width: 1600px) {
          .data-table th, .data-table td {
            padding: 0.7rem 0.5rem !important;
            font-size: 1.1rem !important;
          }
        }
        .data-table .col-periodo {
          position: sticky;
          left: 0;
          z-index: 10;
          background-color: var(--bg-card);
          box-shadow: 2px 0 5px rgba(0,0,0,0.1);
        }
        .data-table th.col-periodo {
          z-index: 11;
        }
        .data-table tbody tr.clickable:hover td.col-periodo {
          filter: brightness(1.1);
        }
        .data-table tbody tr.row-safra td.col-periodo {
          border-left: 3px solid #10b981;
        }
        .data-table .col-fornecedor, .data-table .col-variedade {
          position: sticky;
          left: 0;
          z-index: 10;
          background-color: var(--bg-card);
          box-shadow: 2px 0 5px rgba(0,0,0,0.1);
        }
        .data-table th.col-fornecedor, .data-table th.col-variedade {
          z-index: 11;
        }
        @media (max-width: 768px) {
          .agricola-kpi-container {
            flex-direction: column;
            gap: 1rem;
          }
          .agricola-kpi-row-1 {
            width: 100%;
            justify-content: space-around;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 0.5rem;
          }
          .agricola-kpi-row-2 {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem;
          }
        }
        .plan-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .plan-card {
          cursor: pointer;
          padding: 0.8rem 0.9rem;
          gap: 0.35rem;
          justify-content: flex-start;
        }
        .plan-card::before { background: var(--grupo-cor) !important; }
        .plan-card-title {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--grupo-cor);
        }
        .plan-card-title span,
        .plan-pct-head span {
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .plan-card-title, .plan-pct-head { gap: 0.4rem; }
        .plan-card-title small {
          white-space: nowrap;
          font-size: 0.62rem;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: none;
        }
        .plan-linha {
          display: flex;
          justify-content: space-between;
          font-size: 0.74rem;
          color: var(--text-secondary);
        }
        .plan-linha b {
          font-family: var(--font-display);
          color: var(--text-light);
          font-variant-numeric: tabular-nums;
        }
        .plan-pct { margin-top: 0.3rem; }
        .plan-pct-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 0.66rem;
          text-transform: uppercase;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .plan-pct-head b {
          font-family: var(--font-display);
          font-size: 1.05rem;
          font-variant-numeric: tabular-nums;
        }
        .plan-bar {
          height: 5px;
          border-radius: 3px;
          background: var(--border-subtle);
          overflow: hidden;
          margin-top: 0.15rem;
        }
        .plan-bar > span { display: block; height: 100%; border-radius: 3px; }
        .plan-nota { font-size: 0.64rem; color: var(--text-muted); margin-top: 0.2rem; }
        .plan-ok, .data-table td.plan-ok { color: var(--accent-emerald); }
        .plan-alerta, .data-table td.plan-alerta { color: var(--accent-amber); }
        .plan-critico, .data-table td.plan-critico { color: var(--accent-rose); }
        .plan-sem, .data-table td.plan-sem { color: var(--text-muted); }
        /* Cabeçalho congelado no detalhamento (o .table-responsive é o container que rola) */
        #plan-detalhe .data-table thead th {
          position: sticky;
          top: 0;
          z-index: 12;
          background: var(--bg-surface);
        }
        #plan-detalhe .data-table thead th.col-fornecedor { z-index: 13; }
        .plan-breadcrumb {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          align-items: center;
          font-size: 0.8rem;
          margin-bottom: 0.6rem;
          color: var(--text-muted);
        }
        .plan-breadcrumb a { color: var(--color-total); cursor: pointer; text-decoration: underline; }
        .plan-breadcrumb b { color: var(--text-light); }
        @media (min-width: 1600px) {
          .plan-card-title { font-size: 1rem; }
          .plan-linha { font-size: 0.95rem; }
          .plan-pct-head b { font-size: 1.35rem; }
        }
        .dashboard-resumos-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          margin-top: 0.5rem;
        }
        @media (min-width: 768px) {
          .dashboard-resumos-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1200px) {
          .dashboard-resumos-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
      </style>
      <!-- PLANEJAMENTO X REALIZADO DA COLHEITA -->
      ${this.renderPlanejamentoCards(planejamentoColheita)}

      <div class="section-card" style="margin-top: 0.25rem; padding: 0.75rem;">
        <div class="agricola-kpi-container">
          <div class="agricola-kpi-row-2">
            <div class="agricola-kpi-item">
              <span class="agricola-kpi-label">TCH Prev (Área Tot)</span>
              <span class="agricola-kpi-val">${this.fmt(tch.tchPrevistoTotal, 2)}</span>
            </div>
            <div class="agricola-kpi-item">
              <span class="agricola-kpi-label">TCH Prev (Área Colh)</span>
              <span class="agricola-kpi-val">${this.fmt(tch.tchPrevistoColhida, 2)}</span>
            </div>
            <div class="agricola-kpi-item">
              <span class="agricola-kpi-label">TCH Real (Área Enc)</span>
              <span class="agricola-kpi-val badge-solid-green">TCH ${this.fmt(tch.tchRealizado, 2)}</span>
            </div>
            <div class="agricola-kpi-item">
              <span class="agricola-kpi-label">Variação</span>
              <span class="agricola-kpi-val" style="color: var(--color-propria);">+ ${this.fmt(tch.variacao, 2)}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- TELA CHEIA: páginas do carrossel dos resumos (o TOTAL fica fixo) -->
      <div class="resumos-paginas" role="tablist" aria-label="Resumos em rotação">
        ${this.paginasResumo.map((p, i) => `
          <button type="button" class="resumos-pagina" data-pagina="${i + 1}" onclick="AgricolaView.irParaPagina(${i + 1})">${p}</button>
        `).join('')}
      </div>

      <!-- GRID DOS RESUMOS EM 3 COLUNAS -->
      <div class="dashboard-resumos-grid" data-pagina-ativa="${this.paginaAtiva}">

        <!-- RESUMO TOTAL -->
        <div class="section-card" data-resumo="total" style="margin-bottom: 0; padding: 0.85rem;">
          <div class="section-header" style="margin-bottom: 0.5rem; padding-bottom: 0.4rem;">
            <div class="section-title" style="font-size: 0.88rem; color: var(--color-total);">
              <span>Resumo de Entrada de Cana <b>TOTAL</b></span>
            </div>
            <span class="row-drilldown-hint" style="font-size: 0.65rem;">Clique para detalhar</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th rowspan="2" class="col-periodo" style="vertical-align: middle;">Período</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Ton. Cana</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">ATR</th>
                  <th colspan="2" class="text-center" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem !important;">Impurezas</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Tempo<br>Queima</th>
                </tr>
                <tr>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Veg</th>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Min</th>
                </tr>
              </thead>
              <tbody>
                ${resumoTotal.map((r, idx) => {
                  const isSafra = r.periodo.toLowerCase().includes('safra');
                  const isMedia = r.periodo.toLowerCase().includes('dia') || r.tipo2 === '5';
                  const atrVal = (isMedia && (!r.atr || r.atr === 0)) ? safraTotalRow.atr : r.atr;

                  return `
                    <tr class="clickable ${isSafra ? 'row-safra' : ''}" 
                        onclick="AgricolaView.onRowClick('${r.tipo}', '${r.tipo2}', '${r.periodo}', '${r.datini}', '${r.datfin}', ${r.horini}, ${r.horfin})">
                      <td class="col-periodo" style="font-weight: 600;">${r.periodo}</td>
                      <td class="text-right font-mono" style="font-weight: 700; ${isSafra ? 'color: var(--color-safra);' : 'color: var(--color-propria);'}">${this.fmt(r.pesliq, 3)}</td>
                      <td class="text-right font-mono" style="color: var(--color-total);">${this.fmt(atrVal, 4)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impveg, 2)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impmin, 2)}</td>
                      <td class="text-right font-mono">${r.tq || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RESUMO PRÓPRIA -->
        <div class="section-card" data-resumo="propria" data-pagina="1" style="margin-bottom: 0; padding: 0.85rem;">
          <div class="section-header" style="margin-bottom: 0.5rem; padding-bottom: 0.4rem;">
            <div class="section-title" style="font-size: 0.88rem; color: var(--color-propria);">
              <span>Resumo de Entrada de Cana <b>PRÓPRIA</b></span>
            </div>
            <span class="row-drilldown-hint" style="font-size: 0.65rem;">Clique para detalhar</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th rowspan="2" class="col-periodo" style="vertical-align: middle;">Período</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Ton. Cana</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">ATR</th>
                  <th colspan="2" class="text-center" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem !important;">Impurezas</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Tempo<br>Queima</th>
                </tr>
                <tr>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Veg</th>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Min</th>
                </tr>
              </thead>
              <tbody>
                ${resumoPropria.map((r, idx) => {
                  const isMedia = r.periodo.toLowerCase().includes('dia') || r.tipo2 === '5';
                  const atrVal = (isMedia && (!r.atr || r.atr === 0)) ? safraTotalRow.atr : r.atr;
                  return `
                    <tr class="clickable" 
                        onclick="AgricolaView.onRowClick('${r.tipo}', '${r.tipo2}', '${r.periodo}', '${r.datini}', '${r.datfin}', ${r.horini}, ${r.horfin})">
                      <td class="col-periodo" style="font-weight: 600;">${r.periodo}</td>
                      <td class="text-right font-mono" style="font-weight: 700; color: var(--color-propria);">${this.fmt(r.pesliq, 3)}</td>
                      <td class="text-right font-mono" style="color: var(--color-total);">${this.fmt(atrVal, 4)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impveg, 2)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impmin, 2)}</td>
                      <td class="text-right font-mono">${r.tq || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RESUMO FORNECEDOR -->
        <div class="section-card" data-resumo="fornecedor" data-pagina="1" style="margin-bottom: 0; padding: 0.85rem;">
          <div class="section-header" style="margin-bottom: 0.5rem; padding-bottom: 0.4rem;">
            <div class="section-title" style="font-size: 0.88rem; color: var(--color-fornecedor);">
              <span>Resumo de Entrada de Cana <b>FORNECEDOR</b></span>
            </div>
            <span class="row-drilldown-hint" style="font-size: 0.65rem;">Clique para detalhar</span>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th rowspan="2" class="col-periodo" style="vertical-align: middle;">Período</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Ton. Cana</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">ATR</th>
                  <th colspan="2" class="text-center" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem !important;">Impurezas</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Tempo<br>Queima</th>
                </tr>
                <tr>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Veg</th>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Min</th>
                </tr>
              </thead>
              <tbody>
                ${resumoFornecedor.map((r, idx) => {
                  const isMedia = r.periodo.toLowerCase().includes('dia') || r.tipo2 === '5';
                  const atrVal = (isMedia && (!r.atr || r.atr === 0)) ? safraTotalRow.atr : r.atr;
                  return `
                    <tr class="clickable" 
                        onclick="AgricolaView.onRowClick('${r.tipo}', '${r.tipo2}', '${r.periodo}', '${r.datini}', '${r.datfin}', ${r.horini}, ${r.horfin})">
                      <td class="col-periodo" style="font-weight: 600;">${r.periodo}</td>
                      <td class="text-right font-mono" style="font-weight: 700; color: var(--color-fornecedor);">${this.fmt(r.pesliq, 3)}</td>
                      <td class="text-right font-mono" style="color: var(--color-total);">${this.fmt(atrVal, 4)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impveg, 2)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impmin, 2)}</td>
                      <td class="text-right font-mono">${r.tq || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <!-- RESUMO COLHEDORA -->
        <div class="section-card" data-resumo="colhedora" data-pagina="2" style="margin-bottom: 0; padding: 0.85rem;">
          <div class="section-header" style="margin-bottom: 0.5rem; padding-bottom: 0.4rem;">
            <div class="section-title" style="font-size: 0.88rem; color: var(--color-colhedora);">
              <span>Resumo de Cana de <b>COLHEDORA</b></span>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th rowspan="2" class="col-periodo" style="vertical-align: middle;">Período</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Ton. Cana</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">ATR</th>
                  <th colspan="2" class="text-center" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem !important;">Impurezas</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">% do<br>Total</th>
                </tr>
                <tr>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Veg</th>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Min</th>
                </tr>
              </thead>
              <tbody>
                ${resumoColhedora.map((r, idx) => {
                  const isMedia = r.periodo.toLowerCase().includes('dia');
                  const atrVal = (isMedia && (!r.atr || r.atr === 0)) ? safraTotalRow.atr : r.atr;
                  return `
                    <tr class="clickable" 
                        onclick="AgricolaView.onRowClick('${r.tipo}', '${r.tipo2}', '${r.periodo}', '${r.datini}', '${r.datfin}', ${r.horini}, ${r.horfin}, 'M')">
                      <td class="col-periodo" style="font-weight: 600;">${r.periodo}</td>
                      <td class="text-right font-mono" style="font-weight: 700; color: var(--color-colhedora);">${this.fmt(r.pesliq, 3)}</td>
                      <td class="text-right font-mono" style="color: var(--color-total);">${this.fmt(atrVal, 4)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impveg, 2)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impmin, 2)}</td>
                      <td class="text-right font-mono" style="font-weight: 700; color: var(--color-colhedora);">${pctCorte(r)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RESUMO CORTE MANUAL -->
        <div class="section-card" data-resumo="manual" data-pagina="2" style="margin-bottom: 0; padding: 0.85rem;">
          <div class="section-header" style="margin-bottom: 0.5rem; padding-bottom: 0.4rem;">
            <div class="section-title" style="font-size: 0.88rem; color: var(--color-manual);">
              <span>Resumo de Cana de <b>CORTE MANUAL</b></span>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th rowspan="2" class="col-periodo" style="vertical-align: middle;">Período</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Ton. Cana</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">ATR</th>
                  <th colspan="2" class="text-center" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.2rem !important;">Impurezas</th>
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">% do<br>Total</th>
                </tr>
                <tr>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Veg</th>
                  <th class="text-right" style="padding-top: 0.2rem !important;">Min</th>
                </tr>
              </thead>
              <tbody>
                ${resumoManual.map((r, idx) => {
                  const isMedia = r.periodo.toLowerCase().includes('dia');
                  const atrVal = (isMedia && (!r.atr || r.atr === 0)) ? safraTotalRow.atr : r.atr;
                  return `
                    <tr class="clickable" 
                        onclick="AgricolaView.onRowClick('${r.tipo}', '${r.tipo2}', '${r.periodo}', '${r.datini}', '${r.datfin}', ${r.horini}, ${r.horfin}, 'MAN')">
                      <td class="col-periodo" style="font-weight: 600;">${r.periodo}</td>
                      <td class="text-right font-mono" style="font-weight: 700; color: var(--color-manual);">${this.fmt(r.pesliq, 3)}</td>
                      <td class="text-right font-mono" style="color: var(--color-total);">${this.fmt(atrVal, 4)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impveg, 2)}</td>
                      <td class="text-right font-mono">${this.fmt(r.impmin, 2)}</td>
                      <td class="text-right font-mono" style="font-weight: 700; color: var(--color-manual);">${pctCorte(r)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RESUMO MENSAL -->
        <div class="section-card" data-resumo="mensal" data-pagina="3" style="margin-bottom: 0; padding: 0.85rem;">
          <div class="section-header" style="margin-bottom: 0.5rem; padding-bottom: 0.4rem;">
            <div class="section-title" style="font-size: 0.88rem; color: var(--color-mensal);">
              <span>Resumo de Cana <b>MENSAL</b></span>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="col-periodo" style="vertical-align: middle;">Meses</th>
                  <th class="text-right" style="vertical-align: middle;">Ton.Cana</th>
                  <th class="text-right" style="vertical-align: middle;">PCC</th>
                  <th class="text-right" style="vertical-align: middle;">ATR</th>
                  <th class="text-right" style="vertical-align: middle;">AR</th>
                  <th class="text-right" style="vertical-align: middle;">Fibra</th>
                  <th class="text-right" style="vertical-align: middle;">PZA</th>
                  <th class="text-right" style="vertical-align: middle;">TQ</th>
                </tr>
              </thead>
              <tbody>
                ${resumoMensal.map((r, idx) => {
                  return `
                    <tr>
                      <td class="col-periodo" style="font-weight: 600; text-transform: capitalize;">${r.mes}</td>
                      <td class="text-right font-mono" style="font-weight: 700; color: var(--color-mensal);">${this.fmt(r.pesliq, 3)}</td>
                      <td class="text-right font-mono">${this.fmt(r.pcc, 4)}</td>
                      <td class="text-right font-mono" style="color: var(--color-total);">${this.fmt(r.atr, 4)}</td>
                      <td class="text-right font-mono">${this.fmt(r.ar, 2)}</td>
                      <td class="text-right font-mono">${this.fmt(r.fibra, 2)}</td>
                      <td class="text-right font-mono">${this.fmt(r.pureza, 2)}</td>
                      <td class="text-right font-mono">${r.tq || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    container.innerHTML = html;
    this.marcarPaginaAtiva();
    this.iniciarCarrossel();
  },

  // --- TELA CHEIA: carrossel dos resumos (Própria/Fornecedor -> Mecanizada/Manual -> Mensal) ---------

  paginasResumo: ['Própria · Fornecedor', 'Mecanizada · Manual', 'Resumo Mensal'],
  paginaAtiva: 1,
  carrosselTimer: null,
  CARROSSEL_SEGUNDOS: 15,

  iniciarCarrossel() {
    clearInterval(this.carrosselTimer);
    this.carrosselTimer = setInterval(() => {
      // Só gira na tela cheia, com a aba Agrícola visível e sem detalhamento aberto
      if (!document.body.classList.contains('tela-cheia') || App.currentTab !== 'agricola' || Modal.isOpen()) return;
      this.irParaPagina((this.paginaAtiva % this.paginasResumo.length) + 1);
    }, this.CARROSSEL_SEGUNDOS * 1000);
  },

  irParaPagina(n) {
    const grid = document.querySelector('.dashboard-resumos-grid');
    if (!grid || n === this.paginaAtiva) return;
    this.paginaAtiva = n;
    // Esmaece a página atual e mostra a próxima
    grid.classList.add('saindo');
    setTimeout(() => {
      grid.setAttribute('data-pagina-ativa', String(n));
      grid.classList.remove('saindo');
      this.marcarPaginaAtiva();
    }, 400);
    this.iniciarCarrossel(); // recomeça a contagem após troca manual
  },

  marcarPaginaAtiva() {
    document.querySelectorAll('.resumos-pagina').forEach(b =>
      b.classList.toggle('ativa', Number(b.dataset.pagina) === this.paginaAtiva));
  },

  renderTabelaFornecedores(lista = []) {
    if (!lista || lista.length === 0) {
      return '<p style="padding: 1.5rem; color: var(--text-muted); text-align: center;">Nenhum dado encontrado para o período selecionado.</p>';
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-fornecedor">Fornecedor</th>
            <th>Fazenda</th>
            <th>Corte</th>
            <th class="text-right">Toneladas</th>
            <th class="text-right">Brix</th>
            <th class="text-right">PCC</th>
            <th class="text-right">ATR</th>
            <th class="text-right">AR</th>
            <th class="text-right">Fibra</th>
            <th class="text-right">PZA</th>
            <th class="text-right">TQ</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(r => {
            const isTotal = r.tipo === '2' || r.fornecedor.includes('TOTAL');
            return `
              <tr style="${isTotal ? 'font-weight: 700; background: var(--bg-table-striped); border-top: 1px solid var(--border-subtle);' : ''}">
                <td class="col-fornecedor" style="${isTotal ? 'font-weight: 800; color: var(--text-light);' : 'font-weight: 600; color: var(--text-light);'}">${r.fornecedor}</td>
                <td style="color: var(--text-secondary);">${r.fazenda || ''}</td>
                <td>${r.tipocorte ? `<span class="safra-badge" style="font-size: 0.65rem;">${r.tipocorte}</span>` : ''}</td>
                <td class="text-right font-mono" style="font-weight: 700; color: var(--color-propria);">${this.fmt(r.pesliq, 3)}</td>
                <td class="text-right font-mono">${this.fmt(r.brix, 2)}</td>
                <td class="text-right font-mono">${this.fmt(r.pcc, 4)}</td>
                <td class="text-right font-mono" style="color: var(--color-total);">${this.fmt(r.atr, 4)}</td>
                <td class="text-right font-mono">${this.fmt(r.ar, 2)}</td>
                <td class="text-right font-mono">${this.fmt(r.fibra, 2)}</td>
                <td class="text-right font-mono">${this.fmt(r.pureza, 2)}</td>
                <td class="text-right font-mono" style="color: var(--accent-amber);">${r.tq || '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  renderTabelaVariedades(lista = []) {
    if (!lista || lista.length === 0) {
      return '<p style="padding: 1.5rem; color: var(--text-muted); text-align: center;">Nenhuma variedade registrada no período.</p>';
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-variedade">Variedade</th>
            <th class="text-right" style="width: 140px;">% do Total</th>
            <th class="text-right">Toneladas</th>
            <th class="text-right">Brix</th>
            <th class="text-right">PCC</th>
            <th class="text-right">ATR</th>
            <th class="text-right">AR</th>
            <th class="text-right">Fibra</th>
            <th class="text-right">PZA</th>
            <th class="text-right">TQ</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(r => {
            const isTotal = r.tipo === '2' || r.variedade.includes('TOTAL');
            return `
              <tr style="${isTotal ? 'font-weight: 700; background: var(--bg-table-striped); border-top: 1px solid var(--border-subtle);' : ''}">
                <td class="col-variedade" style="font-weight: 700; color: var(--text-light);">${r.variedade}</td>
                <td class="text-right font-mono">
                  <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
                    <span><b>${this.fmt(r.percentual, 2)}%</b></span>
                    ${!isTotal ? `
                      <div style="width: 50px; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${Math.min(100, r.percentual || 0)}%; height: 100%; background: var(--color-total);"></div>
                      </div>
                    ` : ''}
                  </div>
                </td>
                <td class="text-right font-mono" style="font-weight: 700; color: var(--color-propria);">${this.fmt(r.pesliq, 3)}</td>
                <td class="text-right font-mono">${this.fmt(r.brix, 2)}</td>
                <td class="text-right font-mono">${this.fmt(r.pcc, 4)}</td>
                <td class="text-right font-mono" style="color: var(--color-total);">${this.fmt(r.atr, 4)}</td>
                <td class="text-right font-mono">${this.fmt(r.ar, 2)}</td>
                <td class="text-right font-mono">${this.fmt(r.fibra, 2)}</td>
                <td class="text-right font-mono">${this.fmt(r.pureza, 2)}</td>
                <td class="text-right font-mono" style="color: var(--accent-amber);">${r.tq || '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  async onRowClick(tipo, tipo2, periodo, datini, datfin, horini, horfin, tipcol = 'T') {
    this.selectedPeriod = { tipo, tipo2, periodo, datini, datfin, horini, horfin, tipcol };
    const desc = `Detalhamento - ${periodo.trim()} (${datini} a ${datfin})`;

    Modal.open({
      title: desc,
      width: '95vw',
      htmlContent: `
        <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
          <div class="live-dot" style="margin: 0 auto 0.5rem; width: 10px; height: 10px;"></div>
          <span>Buscando detalhamento de ${periodo.trim()}...</span>
        </div>
      `
    });

    try {
      const res = await API.getAgricolaDetalhe({
        datini: datini,
        datfin: datfin,
        horini: horini,
        horfin: horfin,
        tipo: tipo,
        tipcol: tipcol,
        periodo: periodo.trim()
      });

      if (res && res.success) {
        const bodyEl = document.getElementById('modal-body-content');
        if (bodyEl) {
          bodyEl.innerHTML = `
            <div style="max-height: 600px; overflow-y: auto; padding-right: 0.5rem;">
              <div style="margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 0.5rem; color: var(--text-light);">Por Fornecedor/Fazenda</h4>
                ${this.renderTabelaFornecedores(res.fornecedores)}
              </div>
              <div>
                <h4 style="margin-bottom: 0.5rem; color: var(--text-light);">Por Variedades</h4>
                ${this.renderTabelaVariedades(res.variedades)}
              </div>
            </div>
          `;
        }
      } else {
        const bodyEl = document.getElementById('modal-body-content');
        if (bodyEl) bodyEl.innerHTML = '<p style="padding: 1.5rem; color: var(--accent-rose); text-align: center;">Erro ao carregar os detalhes.</p>';
      }
    } catch (err) {
      console.error('Erro ao buscar detalhe onRowClick:', err);
      const bodyEl = document.getElementById('modal-body-content');
      if (bodyEl) bodyEl.innerHTML = '<p style="padding: 1.5rem; color: var(--accent-rose); text-align: center;">Erro de conexão.</p>';
    }
  },

  openDrawerDetalhe() {
    Drawer.open({
      ...this.selectedPeriod,
      tipcol: this.selectedPeriod.tipcol || 'T'
    });
  },

  // --- PLANEJAMENTO DE COLHEITA -------------------------------------------------

  grupoCores: {
    0: 'var(--color-total)',
    1: 'var(--color-propria)',
    2: 'var(--color-colhedora)',
    3: 'var(--accent-cyan)',
    4: 'var(--color-manual)',
    5: 'var(--color-fornecedor)'
  },

  // Faixas de cumprimento do plano: >= 90% ok, >= 70% alerta, abaixo crítico
  classeCumprimento(pct) {
    if (pct === null || pct === undefined) return 'plan-sem';
    if (pct >= 90) return 'plan-ok';
    if (pct >= 70) return 'plan-alerta';
    return 'plan-critico';
  },

  pct(val) {
    return val === null || val === undefined ? '—' : `${this.fmt(val, 1)}%`;
  },

  esc(txt) {
    return String(txt ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  renderPlanejamentoCards(grupos) {
    if (!grupos) {
      return `<div class="section-card" style="padding: 0.75rem; margin-bottom: 0.75rem; color: var(--text-muted); font-size: 0.8rem;">
        Planejamento de colheita indisponível no momento.</div>`;
    }
    return `
      <div class="plan-grid">
        ${grupos.map(g => {
          const cor = this.grupoCores[g.id];
          const classe = this.classeCumprimento(g.pctCumprimento);
          return `
          <div class="kpi-card plan-card" style="--grupo-cor: ${cor};" onclick="AgricolaView.openPlanejamento(${g.id})"
               title="Clique para detalhar por fornecedor, fazenda e lote">
            <div class="plan-card-title"><span>${this.esc(g.nome)}</span></div>
            <div class="plan-linha"><span>Planejado até hoje</span><b>${this.fmt(g.planejado, 0)} t</b></div>
            <div class="plan-linha"><span>Colhido</span><b>${this.fmt(g.colhido, 0)} t</b></div>
            <div class="plan-linha"><span>Saldo a colher</span><b>${this.fmt(g.saldo, 0)} t</b></div>
            <div class="plan-pct">
              <div class="plan-pct-head"><span title="Colhido ÷ estimado da safra">Evolução colheita</span><b style="color: ${cor};">${this.pct(g.pctEvolucao)}</b></div>
              <div class="plan-bar"><span style="width: ${Math.min(g.pctEvolucao || 0, 100)}%; background: ${cor};"></span></div>
            </div>
            <div class="plan-pct">
              <div class="plan-pct-head"><span title="Colhido ÷ planejado até hoje (pode passar de 100%)">Cumprimento plano</span><b class="${classe}">${this.pct(g.pctCumprimento)}</b></div>
              <div class="plan-bar"><span class="${classe}" style="width: ${Math.min(g.pctCumprimento || 0, 100)}%; background: currentColor;"></span></div>
            </div>
            <div class="plan-nota">${this.fmt(g.lotes, 0)} lotes · ${g.pctCumprimento === null
              ? 'sem planejamento até hoje'
              : `${this.fmt(g.foraPlano, 0)} t colhidas fora do plano`}</div>
          </div>`;
        }).join('')}
      </div>
    `;
  },

  openPlanejamento(grupo) {
    const nome = (this.currentData?.planejamentoColheita || []).find(g => g.id === grupo)?.nome || 'Planejamento';
    Modal.open({
      title: `Planejamento x Realizado — ${nome}`,
      width: '95vw',
      htmlContent: '<div id="plan-detalhe"></div>'
    });
    this.planNav(grupo, null, null, true);
  },

  // Navega no detalhamento; autoPular desce direto para as fazendas quando o grupo tem um único fornecedor
  async planNav(grupo, fornecedor = null, fazenda = null, autoPular = false) {
    const el = document.getElementById('plan-detalhe');
    if (!el) return;
    el.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
        <div class="live-dot" style="margin: 0 auto 0.5rem; width: 10px; height: 10px;"></div>
        <span>Carregando detalhamento...</span>
      </div>`;

    const params = { grupo };
    if (fornecedor !== null) params.fornecedor = fornecedor;
    if (fazenda !== null) params.fazenda = fazenda;
    const data = await API.getAgricolaPlanejamento(params);

    if (!data || !data.success) {
      el.innerHTML = '<p style="padding: 1.5rem; color: var(--accent-rose); text-align: center;">Erro ao carregar o detalhamento.</p>';
      return;
    }
    if (autoPular && data.nivel === 'fornecedores' && data.itens.length === 1) {
      return this.planNav(grupo, data.itens[0].id);
    }
    el.innerHTML = this.renderPlanejamentoDetalhe(data, grupo);
  },

  renderPlanejamentoDetalhe(data, grupo) {
    const { nivel, caminho, total, itens } = data;
    const forn = caminho.find(c => c.nivel === 'fornecedor');

    // Breadcrumb: cada nível anterior é clicável
    const migalhas = caminho.map((c, i) => {
      if (i === caminho.length - 1) return `<b>${this.esc(c.nome)}</b>`;
      const alvo = c.nivel === 'grupo' ? `${grupo}` : `${grupo}, ${forn.id}`;
      return `<a onclick="AgricolaView.planNav(${alvo})">${this.esc(c.nome)}</a>`;
    }).join(' <span>›</span> ');

    const isLote = nivel === 'lotes';
    const mostraGrupo = nivel === 'fornecedores' && grupo === 0;
    const rotulo = { fornecedores: 'Fornecedor', fazendas: 'Fazenda', lotes: 'Lote' }[nivel];
    const clique = (item) => nivel === 'fornecedores'
      ? `AgricolaView.planNav(${grupo}, ${item.id})`
      : nivel === 'fazendas' ? `AgricolaView.planNav(${grupo}, ${forn.id}, ${item.id})` : '';

    const celulas = (m, colunasLote = isLote) => `
      ${colunasLote ? `<td class="text-center font-mono">${m.dataPrevista || '-'}</td>
                  <td class="text-right">${this.fmt(m.area, 2)}</td>
                  <td class="text-right">${this.fmt(m.tchEstimado, 2)}</td>` : ''}
      <td class="text-right">${this.fmt(m.estimado, 1)}</td>
      <td class="text-right">${this.fmt(m.planejado, 1)}</td>
      <td class="text-right" style="font-weight: 700;">${this.fmt(m.colhido, 1)}</td>
      <td class="text-right">${this.fmt(m.foraPlano, 1)}</td>
      <td class="text-right">${this.fmt(m.saldo, 1)}</td>
      <td class="text-right">${this.pct(m.pctEvolucao)}</td>
      <td class="text-right ${this.classeCumprimento(m.pctCumprimento)}" style="font-weight: 700;">${this.pct(m.pctCumprimento)}</td>`;

    const linhas = itens.length === 0
      ? `<tr><td colspan="12" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">Nenhum registro.</td></tr>`
      : itens.map(item => `
        <tr ${isLote ? '' : `class="clickable" style="cursor: pointer;" onclick="${clique(item)}"`}>
          <td class="col-fornecedor" style="font-weight: 600;">${this.esc(item.nome)}</td>
          ${mostraGrupo ? `<td style="color: var(--text-secondary); white-space: nowrap;">${this.esc(item.grupo)}</td>` : ''}
          ${celulas(item)}
        </tr>`).join('');

    return `
      <div class="plan-breadcrumb">${migalhas}</div>
      <div class="plan-nota" style="margin-bottom: 0.5rem;">
        Planejado = volume programado até hoje · Fora do plano = colhido além do programado para o lote ·
        Evolução = colhido ÷ estimado · Cumprimento = colhido ÷ planejado (acima de 100% = colheu mais que o planejado)
        ${isLote ? '' : ' · Clique em uma linha para detalhar'}
      </div>
      <div class="table-responsive" style="max-height: 62vh; overflow-y: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-fornecedor">${rotulo}</th>
              ${mostraGrupo ? '<th>Grupo</th>' : ''}
              ${isLote ? '<th class="text-center">Data Prevista</th><th class="text-right">Área (ha)</th><th class="text-right">TCH Est.</th>' : ''}
              <th class="text-right">Estimado (t)</th>
              <th class="text-right">Planejado (t)</th>
              <th class="text-right">Colhido (t)</th>
              <th class="text-right">Fora do Plano (t)</th>
              <th class="text-right">Saldo (t)</th>
              <th class="text-right">% Evolução</th>
              <th class="text-right">% Cumprimento</th>
            </tr>
          </thead>
          <tbody>
            ${linhas}
            <tr class="row-safra">
              <td class="col-fornecedor" style="font-weight: 700;">TOTAL</td>
              ${mostraGrupo ? '<td></td>' : ''}
              ${isLote ? `<td></td><td class="text-right">${this.fmt(total.area, 2)}</td><td></td>` : ''}
              ${celulas(total, false)}
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  fmt(val, dec = 2) {
    if (val === null || val === undefined || isNaN(val) || val === '') return '-';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
};
