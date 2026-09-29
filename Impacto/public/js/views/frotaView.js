// Views dos Módulos Frota e Disponibilidade da Frota

const FrotaView = {
  selectedFilter: { tipo: 'T', codigo: 6, label: 'Caminhão Plataforma - Treminhão' },

  async render(container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
        <div class="live-dot" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
        <p>Carregando telemetria e movimentação da frota em tempo real...</p>
      </div>
    `;

    const data = await API.getFrota();
    if (!data) {
      container.innerHTML = '<p style="color: var(--accent-rose); padding: 2rem;">Erro ao carregar dados de frota.</p>';
      return;
    }

    const { transportePorTipo = [], carregamentoPorTipo = [], transportePorProprietario = [] } = data;

    // Totais Transporte por tipo
    const totTransp = transportePorTipo.reduce((acc, r) => ({ hoje: acc.hoje + r.hoje, ontem: acc.ontem + r.ontem, semana: acc.semana + r.semana, safra: acc.safra + r.safra, litros: acc.litros + r.litros }), { hoje: 0, ontem: 0, semana: 0, safra: 0, litros: 0 });
    // Totais Carregamento por tipo
    const totCarreg = carregamentoPorTipo.reduce((acc, r) => ({ hoje: acc.hoje + r.hoje, ontem: acc.ontem + r.ontem, semana: acc.semana + r.semana, safra: acc.safra + r.safra, litros: acc.litros + r.litros }), { hoje: 0, ontem: 0, semana: 0, safra: 0, litros: 0 });
    // Totais Proprietário
    const totProp = transportePorProprietario.reduce((acc, r) => ({ hoje: acc.hoje + r.hoje, ontem: acc.ontem + r.ontem, semana: acc.semana + r.semana, safra: acc.safra + r.safra, litros: acc.litros + r.litros }), { hoje: 0, ontem: 0, semana: 0, safra: 0, litros: 0 });

    const html = `
      <style>
        .frota-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 1.25rem;
          align-items: start;
        }
        #frota-modal-detalhe .data-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
          background: var(--bg-surface);
        }
        @media (max-width: 768px) {
          .frota-grid { grid-template-columns: minmax(0, 1fr); }
          .frota-detalhe-panel { display: none; }
          /* Resumos no celular: cada linha vira um bloco (nome + valores rotulados), sem rolagem lateral */
          .frota-resumo thead { display: none; }
          .frota-resumo tr {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.15rem 0.5rem;
            padding: 0.55rem 0.4rem;
            border-bottom: 1px solid var(--border-table);
          }
          .frota-resumo td {
            display: block;
            padding: 0 !important;
            border: none !important;
            text-align: left !important;
            font-size: 0.78rem;
            min-width: 0;
            overflow-wrap: anywhere;
          }
          .frota-resumo td:first-child { grid-column: 1 / -1; font-size: 0.85rem; margin-bottom: 0.15rem; }
          .frota-resumo td[data-label]::before {
            content: attr(data-label);
            display: block;
            font-family: var(--font-sans);
            font-size: 0.6rem;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--text-muted);
          }
          .frota-resumo tr.clickable-row td:first-child::after {
            content: 'Toque para detalhar ›';
            float: right;
            font-size: 0.62rem;
            font-weight: 500;
            color: var(--text-muted);
          }
        }
      </style>
      <div class="frota-grid">
        
        <!-- PAINEL ESQUERDO: 3 TABELAS RESUMO -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- 1. TRANSPORTE POR TIPO DE EQUIPAMENTO -->
          <div class="section-card">
            <div class="section-header">
              <div class="section-title">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                <span>Transporte por Tipo de Equipamento</span>
              </div>
            </div>
            <div class="table-responsive">
              <table class="data-table mini frota-resumo">
                <thead>
                  <tr>
                    <th>Tipo de Equipamento</th>
                    <th style="text-align: right;">Hoje (t)</th>
                    <th style="text-align: right;">Ontem (t)</th>
                    <th style="text-align: right;">Semana (t)</th>
                    <th style="text-align: right;">Safra (t)</th>
                    <th style="text-align: right;">Litros</th>
                    <th style="text-align: right;">Média (l/t)</th>
                  </tr>
                </thead>
                <tbody>
                  ${transportePorTipo.map(r => `
                    <tr class="clickable-row" onclick="FrotaView.loadDetalhe('T', ${r.codTipoEquipamento}, '${r.descricao}')" style="cursor: pointer;">
                      <td style="color: #38bdf8; font-weight: 600;">👉 ${r.descricao}</td>
                      <td class="font-mono" data-label="Hoje (t)" style="text-align: right;">${this.fmt(r.hoje, 3)}</td>
                      <td class="font-mono" data-label="Ontem (t)" style="text-align: right;">${this.fmt(r.ontem, 3)}</td>
                      <td class="font-mono" data-label="Semana (t)" style="text-align: right;">${this.fmt(r.semana, 3)}</td>
                      <td class="font-mono" data-label="Safra (t)" style="text-align: right; font-weight: 700;">${this.fmt(r.safra, 3)}</td>
                      <td class="font-mono" data-label="Litros" style="text-align: right;">${this.fmt(r.litros, 1)}</td>
                      <td class="font-mono" data-label="Média (l/t)" style="text-align: right; color: #34d399;">${r.media !== null ? this.fmt(r.media, 3) : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background: rgba(255,255,255,0.06); font-weight: 700;">
                    <td>Total Transporte</td>
                    <td class="font-mono" data-label="Hoje (t)" style="text-align: right; color: #38bdf8;">${this.fmt(totTransp.hoje, 3)}</td>
                    <td class="font-mono" data-label="Ontem (t)" style="text-align: right;">${this.fmt(totTransp.ontem, 3)}</td>
                    <td class="font-mono" data-label="Semana (t)" style="text-align: right;">${this.fmt(totTransp.semana, 3)}</td>
                    <td class="font-mono" data-label="Safra (t)" style="text-align: right; color: #34d399;">${this.fmt(totTransp.safra, 3)}</td>
                    <td class="font-mono" data-label="Litros" style="text-align: right;">${this.fmt(totTransp.litros, 1)}</td>
                    <td class="font-mono" data-label="Média (l/t)" style="text-align: right; color: #34d399;">${totTransp.safra > 0 ? this.fmt(totTransp.litros / totTransp.safra, 3) : '-'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- 2. CARREGAMENTO POR TIPO DE EQUIPAMENTO -->
          <div class="section-card">
            <div class="section-header">
              <div class="section-title">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                <span>Carregamento por Tipo de Equipamento</span>
              </div>
            </div>
            <div class="table-responsive">
              <table class="data-table mini frota-resumo">
                <thead>
                  <tr>
                    <th>Tipo de Equipamento</th>
                    <th style="text-align: right;">Hoje (t)</th>
                    <th style="text-align: right;">Ontem (t)</th>
                    <th style="text-align: right;">Semana (t)</th>
                    <th style="text-align: right;">Safra (t)</th>
                    <th style="text-align: right;">Litros</th>
                    <th style="text-align: right;">Média (l/t)</th>
                  </tr>
                </thead>
                <tbody>
                  ${carregamentoPorTipo.map(r => `
                    <tr class="clickable-row" onclick="FrotaView.loadDetalhe('C', ${r.codTipoEquipamento}, '${r.descricao}')" style="cursor: pointer;">
                      <td style="color: #fbbf24; font-weight: 600;">👉 ${r.descricao}</td>
                      <td class="font-mono" data-label="Hoje (t)" style="text-align: right;">${this.fmt(r.hoje, 3)}</td>
                      <td class="font-mono" data-label="Ontem (t)" style="text-align: right;">${this.fmt(r.ontem, 3)}</td>
                      <td class="font-mono" data-label="Semana (t)" style="text-align: right;">${this.fmt(r.semana, 3)}</td>
                      <td class="font-mono" data-label="Safra (t)" style="text-align: right; font-weight: 700;">${this.fmt(r.safra, 3)}</td>
                      <td class="font-mono" data-label="Litros" style="text-align: right;">${this.fmt(r.litros, 1)}</td>
                      <td class="font-mono" data-label="Média (l/t)" style="text-align: right; color: #34d399;">${r.media !== null ? this.fmt(r.media, 3) : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background: rgba(255,255,255,0.06); font-weight: 700;">
                    <td>Total Carregamento</td>
                    <td class="font-mono" data-label="Hoje (t)" style="text-align: right; color: #fbbf24;">${this.fmt(totCarreg.hoje, 3)}</td>
                    <td class="font-mono" data-label="Ontem (t)" style="text-align: right;">${this.fmt(totCarreg.ontem, 3)}</td>
                    <td class="font-mono" data-label="Semana (t)" style="text-align: right;">${this.fmt(totCarreg.semana, 3)}</td>
                    <td class="font-mono" data-label="Safra (t)" style="text-align: right; color: #34d399;">${this.fmt(totCarreg.safra, 3)}</td>
                    <td class="font-mono" data-label="Litros" style="text-align: right;">${this.fmt(totCarreg.litros, 1)}</td>
                    <td class="font-mono" data-label="Média (l/t)" style="text-align: right; color: #34d399;">${totCarreg.safra > 0 ? this.fmt(totCarreg.litros / totCarreg.safra, 3) : '-'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- 3. TRANSPORTE POR PROPRIETÁRIO -->
          <div class="section-card">
            <div class="section-header">
              <div class="section-title">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                <span>Transporte por Proprietário</span>
              </div>
            </div>
            <div class="table-responsive">
              <table class="data-table mini frota-resumo">
                <thead>
                  <tr>
                    <th>Proprietário</th>
                    <th style="text-align: right;">Hoje (t)</th>
                    <th style="text-align: right;">Ontem (t)</th>
                    <th style="text-align: right;">Semana (t)</th>
                    <th style="text-align: right;">Safra (t)</th>
                    <th style="text-align: right;">Litros</th>
                    <th style="text-align: right;">Média (l/t)</th>
                  </tr>
                </thead>
                <tbody>
                  ${transportePorProprietario.map(r => `
                    <tr class="clickable-row" onclick="FrotaView.loadDetalhe('P', ${r.codFornecedor}, '${r.nome}')" style="cursor: pointer;">
                      <td style="color: #34d399; font-weight: 600;">👉 ${r.nome}</td>
                      <td class="font-mono" data-label="Hoje (t)" style="text-align: right;">${this.fmt(r.hoje, 3)}</td>
                      <td class="font-mono" data-label="Ontem (t)" style="text-align: right;">${this.fmt(r.ontem, 3)}</td>
                      <td class="font-mono" data-label="Semana (t)" style="text-align: right;">${this.fmt(r.semana, 3)}</td>
                      <td class="font-mono" data-label="Safra (t)" style="text-align: right; font-weight: 700;">${this.fmt(r.safra, 3)}</td>
                      <td class="font-mono" data-label="Litros" style="text-align: right;">${this.fmt(r.litros, 1)}</td>
                      <td class="font-mono" data-label="Média (l/t)" style="text-align: right; color: #34d399;">${r.media !== null ? this.fmt(r.media, 3) : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="background: rgba(255,255,255,0.06); font-weight: 700;">
                    <td>Total Geral</td>
                    <td class="font-mono" data-label="Hoje (t)" style="text-align: right; color: #34d399;">${this.fmt(totProp.hoje, 3)}</td>
                    <td class="font-mono" data-label="Ontem (t)" style="text-align: right;">${this.fmt(totProp.ontem, 3)}</td>
                    <td class="font-mono" data-label="Semana (t)" style="text-align: right;">${this.fmt(totProp.semana, 3)}</td>
                    <td class="font-mono" data-label="Safra (t)" style="text-align: right; color: #34d399;">${this.fmt(totProp.safra, 3)}</td>
                    <td class="font-mono" data-label="Litros" style="text-align: right;">${this.fmt(totProp.litros, 1)}</td>
                    <td class="font-mono" data-label="Média (l/t)" style="text-align: right; color: #34d399;">${totProp.safra > 0 ? this.fmt(totProp.litros / totProp.safra, 3) : '-'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>

        <!-- PAINEL DIREITO: DETALHAMENTO POR EQUIPAMENTO -->
        <div class="section-card frota-detalhe-panel" id="frota-detalhe-panel" style="position: sticky; top: 1rem;">
          <div class="section-header" style="justify-content: space-between;">
            <div class="section-title">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              <span>Detalhamento por Equipamento</span>
            </div>
            <span id="frota-detalhe-badge" class="kpi-badge badge-cyan" style="font-size: 0.75rem;">
              ${this.selectedFilter.label}
            </span>
          </div>

          <div id="frota-detalhe-content" class="table-responsive" style="max-height: 700px; overflow-y: auto;">
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
              <div class="live-dot" style="margin: 0 auto 0.5rem;"></div>
              Carregando equipamentos...
            </div>
          </div>
        </div>

      </div>
    `;

    container.innerHTML = html;

    // Carregar detalhamento inicial (no celular o detalhe abre em janela ao tocar numa linha)
    if (!this.isMobile()) {
      this.loadDetalhe(this.selectedFilter.tipo, this.selectedFilter.codigo, this.selectedFilter.label);
    }
  },

  isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  },

  async loadDetalhe(tipo, codigo, label) {
    this.selectedFilter = { tipo, codigo, label };
    let content;
    if (this.isMobile()) {
      Modal.open({
        title: `Detalhamento por Equipamento — ${label}`,
        width: '95vw',
        htmlContent: '<div id="frota-modal-detalhe" class="table-responsive" style="max-height: 70vh; overflow: auto;"></div>'
      });
      content = document.getElementById('frota-modal-detalhe');
    } else {
      const badge = document.getElementById('frota-detalhe-badge');
      if (badge) badge.innerText = label;
      content = document.getElementById('frota-detalhe-content');
    }
    if (!content) return;

    content.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
        <div class="live-dot" style="margin: 0 auto 0.5rem;"></div>
        Carregando equipamentos...
      </div>
    `;

    const data = await API.getFrotaDetalhe(tipo, codigo);
    const equipamentos = (data && data.equipamentos) ? data.equipamentos : [];

    if (equipamentos.length === 0) {
      content.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">Nenhum equipamento registrado para esta seleção.</p>';
      return;
    }

    const totHoje = equipamentos.reduce((a, e) => a + e.hoje, 0);
    const totOntem = equipamentos.reduce((a, e) => a + e.ontem, 0);
    const totSem = equipamentos.reduce((a, e) => a + e.semana, 0);
    const totSaf = equipamentos.reduce((a, e) => a + e.safra, 0);

    content.innerHTML = `
      <table class="data-table mini">
        <thead>
          <tr>
            <th style="width: 50px;">Cód.</th>
            <th>Equipamento / Modelo</th>
            <th style="text-align: right;">Hoje (t)</th>
            <th style="text-align: right;">Ontem (t)</th>
            <th style="text-align: right;">Semana (t)</th>
            <th style="text-align: right;">Safra (t)</th>
          </tr>
        </thead>
        <tbody>
          ${equipamentos.map(e => `
            <tr>
              <td class="font-mono" style="color: var(--text-muted);">${e.codEquipamento}</td>
              <td style="color: var(--text-light); font-weight: 600;">${e.descricao}</td>
              <td class="font-mono" style="text-align: right; color: ${e.hoje > 0 ? '#34d399' : 'var(--text-muted)'}; font-weight: ${e.hoje > 0 ? '700' : '400'};">${this.fmt(e.hoje, 3)}</td>
              <td class="font-mono" style="text-align: right;">${this.fmt(e.ontem, 3)}</td>
              <td class="font-mono" style="text-align: right;">${this.fmt(e.semana, 3)}</td>
              <td class="font-mono" style="text-align: right; font-weight: 700; color: #38bdf8;">${this.fmt(e.safra, 3)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background: rgba(255,255,255,0.06); font-weight: 700;">
            <td colspan="2">Total (${equipamentos.length} equip.)</td>
            <td class="font-mono" style="text-align: right; color: #34d399;">${this.fmt(totHoje, 3)}</td>
            <td class="font-mono" style="text-align: right;">${this.fmt(totOntem, 3)}</td>
            <td class="font-mono" style="text-align: right;">${this.fmt(totSem, 3)}</td>
            <td class="font-mono" style="text-align: right; color: #38bdf8;">${this.fmt(totSaf, 3)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  },

  fmt(val, dec = 2) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
};

// View do Módulo Disponibilidade da Frota
const DisponibilidadeFrotaView = {
  async render(container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
        <div class="live-dot" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
        <p>Carregando status de pátio, trânsito e manutenção de oficina da frota...</p>
      </div>
    `;

    const data = await API.getFrotaDisponibilidade();
    if (!data) {
      container.innerHTML = '<p style="color: var(--accent-rose); padding: 2rem;">Erro ao carregar disponibilidade de frota.</p>';
      return;
    }

    const { kpis = {}, caminhoes = [], reboques = [], colhedoras = [], carregadeiras = [] } = data;

    const html = `
      <!-- TOP KPI STATUS SUMMARY -->
      <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 1.25rem;">
        <div class="kpi-card cyan">
          <div class="kpi-header">
            <span class="kpi-title">Em Descarga (Pátio Usina)</span>
            <span class="kpi-badge badge-cyan">Operação</span>
          </div>
          <div class="kpi-value" style="color: #38bdf8;">${kpis.emDescarga || 0}</div>
          <div class="kpi-subtext">Equipamentos no pátio industrial</div>
        </div>

        <div class="kpi-card emerald">
          <div class="kpi-header">
            <span class="kpi-title">Em Trânsito / Campo</span>
            <span class="kpi-badge badge-emerald">Disponível</span>
          </div>
          <div class="kpi-value" style="color: #34d399;">${kpis.emTransito || 0}</div>
          <div class="kpi-subtext">Rodando em viagens e colheita</div>
        </div>

        <div class="kpi-card rose">
          <div class="kpi-header">
            <span class="kpi-title">Em Manutenção / Oficina</span>
            <span class="kpi-badge badge-rose">Com OS</span>
          </div>
          <div class="kpi-value" style="color: #f87171;">${kpis.emManutencao || 0}</div>
          <div class="kpi-subtext">Ordens de serviço abertas</div>
        </div>
      </div>

      <!-- 4 COLUNAS: CAMINHÕES, REBOQUES, COLHEITADEIRAS, CARREGADEIRAS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; align-items: start;">
        
        <!-- COLUNA 1: CAMINHÕES -->
        ${this.renderColunaEquipamentos('Caminhões', caminhoes, 'rgba(56, 189, 248, 0.2)', '#38bdf8')}

        <!-- COLUNA 2: REBOQUES -->
        ${this.renderColunaEquipamentos('Reboques / Semi-reboques', reboques, 'rgba(16, 185, 129, 0.2)', '#34d399')}

        <!-- COLUNA 3: COLHEITADEIRAS -->
        ${this.renderColunaEquipamentos('Colheitadeiras', colhedoras, 'rgba(251, 191, 36, 0.2)', '#fbbf24')}

        <!-- COLUNA 4: CARREGADEIRAS & TRATORES -->
        ${this.renderColunaEquipamentos('Carregadeiras & Tratores', carregadeiras, 'rgba(168, 85, 247, 0.2)', '#c084fc')}

      </div>
    `;

    container.innerHTML = html;
  },

  renderColunaEquipamentos(titulo, equipamentos = [], borderColor, titleColor) {
    return `
      <div class="section-card" style="border-top: 3px solid ${titleColor};">
        <div class="section-header" style="justify-content: space-between;">
          <div class="section-title" style="color: ${titleColor};">
            <span>${titulo}</span>
          </div>
          <span class="kpi-badge" style="background: rgba(255,255,255,0.06); font-size: 0.75rem;">
            ${equipamentos.length} unid.
          </span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 550px; overflow-y: auto; padding-right: 0.25rem;">
          ${equipamentos.map(e => {
            const isManutencao = e.status === 'MANUTENCAO';
            const isDescarga = e.status === 'DESCARGA';
            let badgeClass = 'badge-emerald';
            let statusText = 'Em Trânsito';

            if (isManutencao) {
              badgeClass = 'badge-rose';
              statusText = `Oficina (OS #${e.ordemServico})`;
            } else if (isDescarga) {
              badgeClass = 'badge-cyan';
              statusText = 'No Pátio (Descarga)';
            }

            return `
              <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.8rem; box-shadow: var(--shadow-sm);">
                <div>
                  <div style="font-weight: 700; color: var(--text-light);">${e.descricao}</div>
                  <div style="font-size: 0.7rem; color: var(--text-secondary); font-family: monospace;">Cód: ${e.codEquipamento}</div>
                  ${e.oficinaDataHora ? `
                    <div style="font-size: 0.68rem; color: var(--accent-rose); margin-top: 0.15rem; font-weight: 500;">Entrada: ${e.oficinaDataHora}</div>
                  ` : ''}
                </div>
                <span class="kpi-badge ${badgeClass}" style="padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-align: right; white-space: nowrap;">
                  ${statusText}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
};
