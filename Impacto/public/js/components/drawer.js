// Componente Slide-Over Drawer Moderno (Substitui os iframes legados)

const Drawer = {
  overlayEl: null,
  panelEl: null,
  currentData: null,
  activeTab: 'fornecedores',

  init() {
    this.overlayEl = document.getElementById('drawer-overlay');
    if (!this.overlayEl) {
      console.warn('Elemento #drawer-overlay não encontrado no DOM');
      return;
    }

    // Fechar ao clicar fora do painel
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close();
      }
    });

    // Tecla ESC para fechar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  },

  isOpen() {
    return this.overlayEl && this.overlayEl.classList.contains('open');
  },

  async open(params) {
    if (!this.overlayEl) this.init();

    const titleEl = document.getElementById('drawer-title');
    const subtitleEl = document.getElementById('drawer-subtitle');
    const bodyEl = document.getElementById('drawer-body-content');

    if (titleEl) titleEl.innerText = 'Carregando Detalhamento...';
    if (subtitleEl) subtitleEl.innerText = `Período: ${params.periodo || params.datini || 'Atual'}`;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
          <div class="live-dot" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
          <p>Consultando base de dados em tempo real...</p>
        </div>
      `;
    }

    this.overlayEl.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Buscar dados via API
    const data = await API.getAgricolaDetalhe(params);
    this.currentData = data;
    this.render(params);
  },

  close() {
    if (this.overlayEl) {
      this.overlayEl.classList.remove('open');
      document.body.style.overflow = '';
    }
  },

  render(params = {}) {
    const titleEl = document.getElementById('drawer-title');
    const subtitleEl = document.getElementById('drawer-subtitle');
    const bodyEl = document.getElementById('drawer-body-content');

    if (!this.currentData) {
      bodyEl.innerHTML = '<p style="color: var(--accent-rose);">Erro ao carregar dados.</p>';
      return;
    }

    const { fornecedores = [], variedades = [], totalToneladas = 0, totalViagens = 0 } = this.currentData;

    titleEl.innerText = this.currentData.titulo || 'Detalhamento de Entrada de Cana';
    subtitleEl.innerHTML = `
      <span class="safra-badge">${params.tipcol === 'M' ? 'Mecanizada' : (params.tipcol === 'MAN' ? 'Manual' : 'Geral')}</span>
      Total: <b>${this.formatNumber(totalToneladas)} t</b> em <b>${totalViagens} viagens</b>
    `;

    bodyEl.innerHTML = `
      <div class="drawer-tabs">
        <button class="drawer-tab-btn ${this.activeTab === 'fornecedores' ? 'active' : ''}" onclick="Drawer.setTab('fornecedores')">
          Fornecedores & Fazendas (${fornecedores.length})
        </button>
        <button class="drawer-tab-btn ${this.activeTab === 'variedades' ? 'active' : ''}" onclick="Drawer.setTab('variedades')">
          Variedades de Cana (${variedades.length})
        </button>
      </div>

      <div style="margin-bottom: 0.85rem; display: flex; gap: 0.5rem; justify-content: space-between; align-items: center;">
        <input type="text" id="drawer-search" placeholder="Filtrar por nome..." 
               style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); color: white; padding: 0.4rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.8rem; width: 220px;"
               oninput="Drawer.filterTable(this.value)">
        <button onclick="Drawer.exportCsv()" class="nav-tab" style="font-size: 0.75rem; padding: 0.35rem 0.65rem; background: rgba(255,255,255,0.06);">
          Exportar CSV
        </button>
      </div>

      <div id="drawer-table-wrapper" class="table-responsive">
        ${this.renderTabContent()}
      </div>
    `;
  },

  setTab(tab) {
    this.activeTab = tab;
    const wrapper = document.getElementById('drawer-table-wrapper');
    if (wrapper) {
      wrapper.innerHTML = this.renderTabContent();
    }
    document.querySelectorAll('.drawer-tab-btn').forEach(btn => btn.classList.remove('active'));
    event?.target?.classList.add('active');
  },

  renderTabContent() {
    if (this.activeTab === 'fornecedores') {
      const list = this.currentData.fornecedores || [];
      return `
        <table class="data-table" id="drawer-data-table">
          <thead>
            <tr>
              <th>Fornecedor / Fazenda</th>
              <th>Corte</th>
              <th class="text-right">Viagens</th>
              <th class="text-right">Ton (Líquido)</th>
              <th class="text-right">% Part.</th>
              <th class="text-right">Média/Vg</th>
              <th class="text-right">Brix</th>
              <th class="text-right">Pol</th>
              <th class="text-right">TCH</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(f => `
              <tr>
                <td>
                  <div style="font-weight: 600; color: var(--text-light);">${f.fornecedor}</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">${f.fazenda}</div>
                </td>
                <td><span class="kpi-badge badge-cyan">${f.tipocorte || 'MEC.'}</span></td>
                <td class="text-right font-mono">${f.viagens}</td>
                <td class="text-right font-mono" style="font-weight: 600; color: #34d399;">${this.formatNumber(f.pesliq)}</td>
                <td class="text-right font-mono">${f.partic ? f.partic.toFixed(1) + '%' : '-'}</td>
                <td class="text-right font-mono">${f.mediaviagem ? f.mediaviagem.toFixed(2) : '-'}</td>
                <td class="text-right font-mono">${f.brix ? f.brix.toFixed(1) + '°' : '-'}</td>
                <td class="text-right font-mono">${f.pol ? f.pol.toFixed(1) + '%' : '-'}</td>
                <td class="text-right font-mono" style="font-weight: 600; color: var(--accent-amber);">${f.tch ? f.tch.toFixed(1) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      const list = this.currentData.variedades || [];
      return `
        <table class="data-table" id="drawer-data-table">
          <thead>
            <tr>
              <th>Variedade</th>
              <th class="text-right">Viagens</th>
              <th class="text-right">Ton (Líquido)</th>
              <th class="text-right">% Partic.</th>
              <th class="text-right">Média/Viagem</th>
              <th class="text-right">Brix Extrato</th>
              <th class="text-right">Pol Extrato</th>
              <th class="text-right">ATR (kg/t)</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(v => `
              <tr>
                <td>
                  <span style="font-weight: 700; color: var(--text-light);">${v.variedade}</span>
                </td>
                <td class="text-right font-mono">${v.viagens}</td>
                <td class="text-right font-mono" style="font-weight: 600; color: #34d399;">${this.formatNumber(v.pesliq)}</td>
                <td class="text-right font-mono">${v.partic ? v.partic.toFixed(1) + '%' : '-'}</td>
                <td class="text-right font-mono">${v.mediaviagem ? v.mediaviagem.toFixed(2) : '-'}</td>
                <td class="text-right font-mono">${v.brix ? v.brix.toFixed(1) + '°' : '-'}</td>
                <td class="text-right font-mono">${v.pol ? v.pol.toFixed(1) + '%' : '-'}</td>
                <td class="text-right font-mono" style="font-weight: 600; color: var(--accent-cyan);">${v.atr ? v.atr.toFixed(1) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  },

  filterTable(query) {
    const table = document.getElementById('drawer-data-table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    const term = query.toLowerCase();

    rows.forEach(r => {
      const text = r.innerText.toLowerCase();
      r.style.display = text.includes(term) ? '' : 'none';
    });
  },

  exportCsv() {
    if (!this.currentData) return;
    const items = this.activeTab === 'fornecedores' ? this.currentData.fornecedores : this.currentData.variedades;
    if (!items || items.length === 0) return;

    const headers = Object.keys(items[0]).join(';');
    const rows = items.map(obj => Object.values(obj).join(';')).join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + headers + '\n' + rows;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `detalhamento_${this.activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return '0,00';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};
