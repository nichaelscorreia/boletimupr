// Componente Modal Moderno para Paradas da Indústria e Avisos

const Modal = {
  overlayEl: null,

  init() {
    this.overlayEl = document.getElementById('modal-overlay');
    if (!this.overlayEl) return;

    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  },

  isOpen() {
    return this.overlayEl && this.overlayEl.classList.contains('open');
  },

  open({ title, htmlContent, width = '650px' }) {
    if (!this.overlayEl) this.init();

    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body-content');
    const contentEl = document.querySelector('.modal-content');

    if (titleEl) titleEl.innerText = title;
    if (bodyEl) bodyEl.innerHTML = htmlContent;
    if (contentEl) contentEl.style.maxWidth = width;

    this.overlayEl.classList.add('open');
  },

  close() {
    if (this.overlayEl) {
      this.overlayEl.classList.remove('open');
    }
  },

  async openParadasIndustria() {
    this.open({
      title: `Ocorrências e Paradas da Moenda - Histórico Recente`,
      width: '800px',
      htmlContent: `
        <div style="text-align: center; padding: 2rem 1rem;">
          <div class="live-dot" style="margin: 0 auto 0.75rem; width: 12px; height: 12px;"></div>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">Carregando histórico de ocorrências e paradas...</p>
        </div>
      `
    });

    const data = await API.getIndustria();
    const paradas = data?.paradas || [];

    if (paradas.length === 0) {
      const bodyEl = document.getElementById('modal-body-content');
      if (bodyEl) bodyEl.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">Nenhuma parada registrada nos últimos 15 dias.</p>';
      return;
    }

    const html = `
      <div class="table-responsive" style="max-height: 480px; overflow-y: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 90px;">Data</th>
              <th style="width: 110px;">Horário</th>
              <th style="width: 90px; text-align: center;">Duração</th>
              <th>Linha / Objeto</th>
              <th>Causa / Motivo</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            ${paradas.map(p => `
              <tr>
                <td class="font-mono" style="font-weight: 600;">${p.datmov}</td>
                <td class="font-mono">${p.horaIni} - ${p.horaFim || 'em andamento'}</td>
                <td class="font-mono" style="text-align: center; font-weight: 700; color: #fb7185;">${p.tempoParada || '-'}</td>
                <td style="color: #38bdf8; font-weight: 600;">${p.objeto || '-'}</td>
                <td style="color: var(--text-light); font-weight: 600;">${p.causa || '-'}</td>
                <td style="color: var(--text-muted); font-size: 0.75rem;">${p.observacao || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const bodyEl = document.getElementById('modal-body-content');
    if (bodyEl) bodyEl.innerHTML = html;
  }
};
