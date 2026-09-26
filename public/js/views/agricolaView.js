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
    const { dathor, resumoTotal = [], resumoPropria = [], resumoFornecedor = [], resumoColhedora = [], resumoManual = [], estimativaSafra: est, rendimentoTch: tch, resumoMensal = [], detalheFornecedores = [], detalheVariedades = [] } = data;

    // Encontrar linha da Safra para dados de qualidade padrão caso Média/Dia venha sem PCC
    const safraTotalRow = resumoTotal.find(r => r.periodo.toLowerCase().includes('safra')) || {};

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
        .dashboard-resumos-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          margin-top: 0.5rem;
        }
        @media (min-width: 768px) {
          .dashboard-resumos-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1200px) {
          .dashboard-resumos-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      </style>
      <div class="section-card" style="margin-top: 0.25rem; padding: 0.75rem;">
        <div class="agricola-kpi-container">
          <div class="agricola-kpi-row-1">
            <div class="agricola-kpi-item">
              <span class="agricola-kpi-label">Ton. Prevista Total</span>
              <span class="agricola-kpi-val" style="color: var(--text-light);">${this.fmt(est.toneladasPrevistas, 3)}</span>
            </div>
            <div class="agricola-kpi-item">
              <span class="agricola-kpi-label">Saldo a Colher</span>
              <span class="agricola-kpi-val badge-solid-green">${this.fmt(est.saldoColher, 3)}</span>
            </div>
          </div>
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

      <!-- GRID DOS RESUMOS EM 3 COLUNAS -->
      <div class="dashboard-resumos-grid">
        
        <!-- RESUMO TOTAL -->
        <div class="section-card" style="margin-bottom: 0; padding: 0.85rem;">
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
        <div class="section-card" style="margin-bottom: 0; padding: 0.85rem;">
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
        <div class="section-card" style="margin-bottom: 0; padding: 0.85rem;">
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
        <div class="section-card" style="margin-bottom: 0; padding: 0.85rem;">
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
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Tempo<br>Queima</th>
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
                      <td class="text-right font-mono">${r.tq || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RESUMO CORTE MANUAL -->
        <div class="section-card" style="margin-bottom: 0; padding: 0.85rem;">
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
                  <th rowspan="2" class="text-right" style="vertical-align: middle;">Tempo<br>Queima</th>
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
                      <td class="text-right font-mono">${r.tq || '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RESUMO MENSAL -->
        <div class="section-card" style="margin-bottom: 0; padding: 0.85rem;">
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

  fmt(val, dec = 2) {
    if (val === null || val === undefined || isNaN(val) || val === '') return '-';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
};
