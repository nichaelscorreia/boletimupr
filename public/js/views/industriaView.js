// View do Módulo Indústria (Substitui mobile_Industria.jsp e graficos.jsp)

const IndustriaView = {
  async render(container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
        <div class="live-dot" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
        <p>Carregando status das Moendas...</p>
      </div>
    `;

    const data = await API.getIndustria();
    if (!data) {
      container.innerHTML = '<p style="color: var(--accent-rose); padding: 2rem;">Erro ao carregar dados industriais.</p>';
      return;
    }

    const { moendas = [], paradas = [] } = data;
    const isMobile = window.innerWidth <= 768;

    const html = `
      <div class="section-card" style="margin-bottom: 1.25rem;">
        <div class="section-header" style="justify-content: space-between; ${isMobile ? 'display: none;' : ''}">
          <div class="section-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
            <span>Status da Fábrica</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Posição em <b>${data.dathor || ''}</b></span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
          ${moendas.map(m => {
            const isRodando = m.status === 'RODANDO';
            const isEntreSafra = m.status === 'Parada de Entre-Safra' || m.statusColor === 'slate';
            const badgeClass = isEntreSafra ? 'badge-slate' : (isRodando ? 'badge-emerald' : 'badge-rose');
            const borderClass = isEntreSafra ? 'status-entresafra' : (isRodando ? 'status-rodando' : 'status-parada');
            const borderColor = isEntreSafra ? 'rgba(148,163,184,0.4)' : (isRodando ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)');
            const dotColor = isEntreSafra ? '#94a3b8' : (isRodando ? '#10b981' : '#f43f5e');
            const motivoColor = isEntreSafra ? 'var(--text-secondary)' : 'var(--text-light)';
            
            // Filtrar as paradas para esta moenda específica (Moenda A = 3, Moenda B = 355)
            const codObjEsperado = m.id === 'moenda_a' ? 3 : 355;
            const paradasDestaMoenda = paradas.filter(p => p.codObjeto == codObjEsperado);
            
            const isMobile = window.innerWidth <= 768;
            const detailsOpenAttr = isMobile ? '' : 'open';

            return `
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- CARD DA MOENDA -->
                <div class="moenda-card ${borderClass}" style="background: var(--bg-card); border: 1px solid ${borderColor}; border-radius: var(--radius-md); padding: 1.25rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.2rem; font-weight: 700; color: var(--text-light); font-family: var(--font-display);">${m.nome}</h3>
                    <span class="kpi-badge ${badgeClass}" style="font-size: 0.85rem; padding: 0.3rem 0.75rem; font-weight: 700; letter-spacing: 0.5px;">
                      <span class="live-dot" style="background: ${dotColor};"></span>
                      ${m.status}
                    </span>
                  </div>

                  <div style="background: rgba(0,0,0,0.25); border-radius: 8px; padding: 0.85rem; font-size: 0.85rem; line-height: 1.5;">
                    <div style="color: var(--text-muted); margin-bottom: 0.25rem;">
                      <b style="color: ${motivoColor};">${m.motivo}</b>
                    </div>
                    ${m.dataHora && m.dataHora !== '.' ? `
                      <div style="color: var(--text-secondary); font-size: 0.8rem;">
                        ${m.dataHora} ${m.horaIni ? m.horaIni : ''} ${m.horaFim && m.horaFim !== '.' ? 'até ' + m.horaFim : ''}
                      </div>
                    ` : ''}
                    ${m.tempo && m.tempo !== '.' ? `
                      <div style="color: var(--text-secondary); font-weight: 600; font-size: 0.8rem; margin-top: 0.25rem;">
                        ${m.tempo}
                      </div>
                    ` : ''}
                  </div>
                  
                  <!-- HISTÓRICO DE PARADAS DA MOENDA -->
                  <details ${detailsOpenAttr} style="background: rgba(0,0,0,0.15); border-radius: 8px; padding: 0.85rem; border: 1px solid rgba(255,255,255,0.05); margin-top: 1rem;">
                    <summary style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; cursor: pointer; font-weight: 600; outline: none;">
                    Últimas Paradas (${paradasDestaMoenda.length})
                  </summary>
                  ${paradasDestaMoenda.length === 0 ? `
                    <p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">Nenhuma parada recente registrada.</p>
                  ` : `
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">
                      ${paradasDestaMoenda.map(p => `
                        <div style="background: rgba(0,0,0,0.2); border-left: 3px solid #fb7185; border-radius: 4px; padding: 0.75rem; font-size: 0.8rem;">
                          <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span style="color: var(--text-light); font-weight: 600;">${p.datmov}</span>
                            <span style="color: #fb7185; font-weight: 700;">${p.tempoParada}</span>
                          </div>
                          <div style="color: var(--text-secondary); margin-bottom: 0.25rem;">
                            De <b>${p.horaIni}</b> às <b>${p.horaFim}</b>
                          </div>
                          <div style="color: var(--text-light); margin-bottom: 0.25rem;">
                            <b>Causa:</b> ${p.causa || '-'}
                          </div>
                          ${p.observacao ? `
                            <div style="color: var(--text-muted); font-style: italic; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 0.4rem; padding-top: 0.4rem;">
                              "${p.observacao}"
                            </div>
                          ` : ''}
                        </div>
                      `).join('')}
                    </div>
                  `}
                  </details>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  fmt(val, dec = 2) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
};
