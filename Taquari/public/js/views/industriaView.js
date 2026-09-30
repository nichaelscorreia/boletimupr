// View do Módulo Indústria (Substitui mobile_Industria.jsp e graficos.jsp)

const IndustriaView = {
  // Blocos abertos/fechados pelo usuário (sobrevive à atualização automática da tela)
  blocosAbertos: {},

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

    const { moendas = [], paradas = [], paradasPorCausa = null } = data;

    container.innerHTML = `
      <style>
        .ind-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 1rem;
          margin-bottom: 0.9rem;
        }
        .ind-header h2 {
          font-family: var(--font-display);
          font-size: 1.05rem;
          color: var(--text-light);
        }
        .ind-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1.25rem;
          align-items: start;
        }
        .ind-moenda {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-top: 4px solid var(--ind-cor);
          border-radius: var(--radius-lg);
          padding: 1.1rem 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          min-width: 0;
        }
        .ind-topo { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
        .ind-topo h3 { font-family: var(--font-display); font-size: 1.35rem; color: var(--text-light); }
        .ind-status {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.85rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          padding: 0.35rem 0.8rem;
          border-radius: var(--radius-full);
          color: var(--ind-cor);
          background: var(--ind-fundo);
          white-space: nowrap;
        }
        .ind-status .live-dot { background: var(--ind-cor); box-shadow: 0 0 8px var(--ind-cor); }
        .ind-motivo {
          background: var(--ind-fundo);
          border-radius: var(--radius-md);
          padding: 0.7rem 0.85rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .ind-motivo b { color: var(--text-light); }
        .ind-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.6rem; }
        .ind-kpi {
          background: var(--bg-table-striped);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 0.55rem 0.7rem;
          text-align: center;
        }
        .ind-kpi span {
          display: block;
          font-size: 0.66rem;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .ind-kpi b {
          font-family: var(--font-mono);
          font-size: 1.25rem;
          color: var(--text-light);
          font-variant-numeric: tabular-nums;
        }
        .ind-kpi b.ind-zero { color: var(--text-muted); }
        .ind-bloco {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          background: var(--bg-table-striped);
        }
        .ind-bloco > summary {
          list-style: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 0.85rem;
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--text-light);
          cursor: pointer;
          user-select: none;
        }
        .ind-bloco > summary::-webkit-details-marker { display: none; }
        .ind-bloco > summary small { font-weight: 500; color: var(--text-muted); }
        .ind-bloco > summary::after {
          content: 'Mostrar ▾';
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--accent-emerald);
          border: 1px solid var(--accent-emerald);
          border-radius: var(--radius-full);
          padding: 0.15rem 0.6rem;
          white-space: nowrap;
        }
        .ind-bloco[open] > summary::after { content: 'Ocultar ▴'; }
        .ind-bloco[open] > summary { border-bottom: 1px solid var(--border-subtle); }
        .ind-bloco .data-table th, .ind-bloco .data-table td { padding: 0.45rem 0.7rem; }
        .ind-bloco .data-table td.ind-horas { font-family: var(--font-mono); text-align: right; font-variant-numeric: tabular-nums; }
        .ind-bloco .data-table td.ind-horas.ind-zero { color: var(--text-muted); }
        .ind-bloco .data-table tr.ind-total td { font-weight: 700; color: var(--text-light); border-top: 1px solid var(--border-subtle); }
        .ind-lista { display: flex; flex-direction: column; gap: 0.45rem; max-height: 360px; overflow-y: auto; padding: 0.7rem 0.85rem; }
        .ind-parada {
          border-left: 3px solid #fb7185;
          background: var(--bg-card);
          border-radius: 4px;
          padding: 0.5rem 0.7rem;
          font-size: 0.8rem;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.1rem 0.75rem;
        }
        .ind-parada .ind-quando { color: var(--text-light); font-weight: 600; }
        .ind-parada .ind-duracao { color: #fb7185; font-weight: 700; font-family: var(--font-mono); text-align: right; }
        .ind-parada .ind-causa { color: var(--text-secondary); grid-column: 1 / -1; }
        .ind-parada .ind-obs { color: var(--text-muted); font-style: italic; grid-column: 1 / -1; overflow-wrap: anywhere; }
        @media (max-width: 900px) {
          .ind-grid { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 768px) {
          .ind-header { display: none; }
          .ind-moenda { padding: 0.9rem; }
          .ind-kpi b { font-size: 1.05rem; }
        }
        @media (min-width: 1600px) {
          .ind-bloco .data-table th, .ind-bloco .data-table td { font-size: 1rem; }
          .ind-kpi b { font-size: 1.5rem; }
        }
      </style>

      <div class="ind-header">
        <h2>Status da Fábrica</h2>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Posição em <b>${this.esc(data.dathor || '')}</b></span>
      </div>

      <div class="ind-grid">
        ${moendas.map(m => this.renderMoenda(m, paradas, paradasPorCausa)).join('')}
      </div>
    `;
  },

  renderMoenda(m, paradas, paradasPorCausa) {
    const isRodando = m.status === 'RODANDO';
    const isEntreSafra = m.statusColor === 'slate';
    const cor = isEntreSafra ? '#94a3b8' : (isRodando ? '#10b981' : '#f43f5e');
    const fundo = isEntreSafra ? 'rgba(148,163,184,0.12)' : (isRodando ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)');

    // Taquari: Recepção = objeto 2, Moenda = objeto 3 (mesma ordem de STATUS_A/STATUS_B em industria_statusFabrica.sql)
    const codObj = m.id === 'moenda_a' ? '2' : '3';
    const ultimas = paradas.filter(p => String(p.codObjeto) === codObj);
    const causas = paradasPorCausa ? paradasPorCausa.filter(c => String(c.codObjeto) === codObj) : null;
    const tot = (causas || []).reduce((a, c) => ({ hoje: a.hoje + c.minHoje, ontem: a.ontem + c.minOntem, safra: a.safra + c.minSafra }), { hoje: 0, ontem: 0, safra: 0 });

    const temParada = !isRodando && m.dataHora && m.dataHora !== '.';
    // Parada em andamento: o banco devolve o tempo vazio ("Tempo total parada: :")
    const tempoOk = m.tempo && /\d/.test(m.tempo);
    const motivo = `
      <div class="ind-motivo">
        <b>${this.esc(m.motivo)}</b>
        ${temParada ? `<br>${this.esc(m.dataHora)} ${this.esc(m.horaIni || '')}${m.horaFim && m.horaFim !== '.' ? ` até ${this.esc(m.horaFim)}` : ''}` : ''}
        ${temParada ? `<br>${tempoOk ? this.esc(m.tempo) : '<b>Em andamento</b>'}` : ''}
      </div>`;

    const horas = (min, classe = '') => `<b class="${classe} ${min ? '' : 'ind-zero'}">${this.horas(min)}</b>`;
    const celula = (min) => `<td class="ind-horas ${min ? '' : 'ind-zero'}">${this.horas(min)}</td>`;

    const blocoCausas = causas === null
      ? '<p style="padding: 0.85rem; color: var(--text-muted); font-size: 0.8rem;">Paradas por causa indisponíveis no momento.</p>'
      : causas.length === 0
        ? '<p style="padding: 0.85rem; color: var(--text-muted); font-size: 0.8rem; text-align: center;">Nenhuma parada na safra.</p>'
        : `
        <div class="table-responsive" style="border: none; border-radius: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Causa</th>
                <th class="text-right">Hoje</th>
                <th class="text-right">Ontem</th>
                <th class="text-right">Safra</th>
              </tr>
            </thead>
            <tbody>
              ${causas.map(c => `
                <tr>
                  <td style="font-weight: 600;">${this.esc(c.causa)} <small style="color: var(--text-muted); font-weight: 400;">(${c.qtdSafra}x)</small></td>
                  ${celula(c.minHoje)}${celula(c.minOntem)}${celula(c.minSafra)}
                </tr>`).join('')}
              <tr class="ind-total">
                <td>TOTAL</td>
                ${celula(tot.hoje)}${celula(tot.ontem)}${celula(tot.safra)}
              </tr>
            </tbody>
          </table>
        </div>`;

    const blocoUltimas = ultimas.length === 0
      ? '<p style="padding: 0.85rem; color: var(--text-muted); font-size: 0.8rem; text-align: center;">Nenhuma parada nos últimos 15 dias.</p>'
      : `
        <div class="ind-lista">
          ${ultimas.map(p => `
            <div class="ind-parada">
              <span class="ind-quando">${this.esc(p.datmov)} · ${this.esc(p.horaIni)} às ${p.horaFim ? this.esc(p.horaFim) : '<i>em andamento</i>'}</span>
              <span class="ind-duracao">${/\d/.test(p.tempoParada || '') ? this.esc(p.tempoParada) : ''}</span>
              <span class="ind-causa">${this.esc(p.causa || '-')}</span>
              ${p.observacao ? `<span class="ind-obs">${this.esc(p.observacao)}</span>` : ''}
            </div>`).join('')}
        </div>`;

    return `
      <div class="ind-moenda" style="--ind-cor: ${cor}; --ind-fundo: ${fundo};">
        <div class="ind-topo">
          <h3>${this.esc(m.nome)}</h3>
          <span class="ind-status"><span class="live-dot"></span>${this.esc(m.status)}</span>
        </div>
        ${motivo}
        ${causas ? `
        <div class="ind-kpis" title="Horas paradas (todas as causas)">
          <div class="ind-kpi"><span>Parada hoje</span>${horas(tot.hoje)}</div>
          <div class="ind-kpi"><span>Parada ontem</span>${horas(tot.ontem)}</div>
          <div class="ind-kpi"><span>Parada safra</span>${horas(tot.safra)}</div>
        </div>` : ''}
        ${this.bloco(`${m.id}-causas`, 'Paradas por causa', causas ? `${causas.length} causas · horas` : '', blocoCausas)}
        ${this.bloco(`${m.id}-ultimas`, 'Últimas paradas', `${ultimas.length} nos últimos 15 dias`, blocoUltimas)}
      </div>`;
  },

  // Bloco recolhível: aberto no computador/TV, fechado no celular, respeitando a escolha do usuário
  bloco(id, titulo, sub, conteudo) {
    const aberto = id in this.blocosAbertos ? this.blocosAbertos[id] : window.innerWidth > 768;
    return `
      <details class="ind-bloco" ${aberto ? 'open' : ''} ontoggle="IndustriaView.blocosAbertos['${id}'] = this.open">
        <summary><span>${titulo} ${sub ? `<small>${sub}</small>` : ''}</span></summary>
        ${conteudo}
      </details>`;
  },

  // Minutos -> "HH:MM" (pode passar de 24h na safra); zero vira "—"
  horas(min) {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },

  esc(txt) {
    return String(txt ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  fmt(val, dec = 2) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
};
