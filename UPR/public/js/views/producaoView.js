// Views dos Módulos Produção Diária e Produção Semanal

const ProducaoView = {
  async render(container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
        <div class="live-dot" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
        <p>Carregando histórico diário e produção horária em tempo real (Safra 54)...</p>
      </div>
    `;

    const data = await API.getProducao();
    if (!data) {
      container.innerHTML = '<p style="color: var(--accent-rose); padding: 2rem;">Erro ao carregar dados de produção.</p>';
      return;
    }

    const { historicoDiario = [], horarioHidratado = [], horarioAnidro = [], horarioAcucar = [], totaisSafra = {} } = data;

    // Calcular totais das tabelas horárias de hoje
    const totHid = horarioHidratado.reduce((acc, h) => ({ prod: acc.prod + h.producao, saida: acc.saida + h.saida, carros: acc.carros + h.qtdCarros }), { prod: 0, saida: 0, carros: 0 });
    const totAni = horarioAnidro.reduce((acc, h) => ({ prod: acc.prod + h.producao, saida: acc.saida + h.saida, carros: acc.carros + h.qtdCarros }), { prod: 0, saida: 0, carros: 0 });
    const totAcu = horarioAcucar.reduce((acc, h) => ({ prod: acc.prod + h.producao, saida: acc.saida + h.saida, carros: acc.carros + h.qtdCarros }), { prod: 0, saida: 0, carros: 0 });

    const html = `
      <!-- TABELA HISTÓRICO DIÁRIO -->
      <div class="section-card" style="margin-bottom: 1.25rem;">
        <div class="section-header" style="justify-content: space-between;">
          <div class="section-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            <span>Mapa de Produção Diária e Saída de Produtos</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Posição em <b>${data.dathor || ''}</b></span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 95px;">Data</th>
                <th style="text-align: right;">Cana Entrada (t)</th>
                <th style="text-align: right;">Cana Moída (t)</th>
                <th style="text-align: right;">Efic (%)</th>
                <th style="text-align: right;">PCC (%)</th>
                <th style="text-align: right;">ATR (kg/t)</th>
                <th style="text-align: right;">Pureza (%)</th>
                <th style="text-align: right;">Fibra (%)</th>
                <th style="text-align: center;">TQ</th>
                <th style="text-align: right;">Prod. Equiv. (scs)</th>
                <th style="text-align: right;">Hidratado (L)</th>
                <th style="text-align: right;">Anidro (L)</th>
                <th style="text-align: right; color: #34d399;">Açúcar (scs)</th>
              </tr>
            </thead>
            <tbody>
              ${historicoDiario.map((row, idx) => {
                const isPrimeiraLinha = idx === 0;
                return `
                  <tr style="${isPrimeiraLinha ? 'background: rgba(16, 185, 129, 0.08); font-weight: 600;' : ''}">
                    <td class="font-mono" style="font-weight: 700; color: ${isPrimeiraLinha ? '#34d399' : 'var(--text-light)'};">${row.datmov}</td>
                    <td class="font-mono" style="text-align: right;">${this.fmt(row.canaEntrada, 3)}</td>
                    <td class="font-mono" style="text-align: right; color: #38bdf8;">${row.canaMoida !== null ? this.fmt(row.canaMoida, 3) : '-'}</td>
                    <td class="font-mono" style="text-align: right; color: ${row.eficiencia >= 85 ? '#34d399' : '#fbbf24'};">${row.eficiencia !== null ? this.fmt(row.eficiencia, 0) + '%' : '-'}</td>
                    <td class="font-mono" style="text-align: right;">${row.pcc !== null ? this.fmt(row.pcc, 4) : '-'}</td>
                    <td class="font-mono" style="text-align: right; font-weight: 700; color: #fbbf24;">${row.atr !== null ? this.fmt(row.atr, 4) : '-'}</td>
                    <td class="font-mono" style="text-align: right;">${row.pureza !== null ? this.fmt(row.pureza, 4) : '-'}</td>
                    <td class="font-mono" style="text-align: right;">${row.fibra !== null ? this.fmt(row.fibra, 4) : '-'}</td>
                    <td class="font-mono" style="text-align: center; color: var(--text-muted);">${row.tq || '-'}</td>
                    <td class="font-mono" style="text-align: right; color: #38bdf8;">${row.prodEquiv !== null ? this.fmt(row.prodEquiv, 0) : '-'}</td>
                    <td class="font-mono" style="text-align: right;">${row.prodHidratado !== null ? this.fmt(row.prodHidratado, 0) : '-'}</td>
                    <td class="font-mono" style="text-align: right;">${row.prodAnidro !== null ? this.fmt(row.prodAnidro, 0) : '-'}</td>
                    <td class="font-mono" style="text-align: right; font-weight: 700; color: #34d399;">${row.prodAcucar !== null ? this.fmt(row.prodAcucar, 0) : '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TABELAS HORÁRIAS HOJE: ÁLCOOL HIDRATADO, ANIDRO E AÇÚCAR -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
        
        <!-- 1. Álcool Hidratado -->
        <div class="section-card">
          <div class="section-header" style="background: rgba(56, 189, 248, 0.1); border-bottom: 1px solid rgba(56, 189, 248, 0.2);">
            <div class="section-title" style="color: #38bdf8;">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
              <span>Álcool Hidratado (m³) - Hoje</span>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table mini">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th style="text-align: right;">Produção</th>
                  <th style="text-align: right;">Saída</th>
                  <th style="text-align: center;">Carros</th>
                </tr>
              </thead>
              <tbody>
                ${horarioHidratado.map(h => `
                  <tr>
                    <td class="font-mono">${h.descricao}</td>
                    <td class="font-mono" style="text-align: right;">${this.fmt(h.producao, 0)}</td>
                    <td class="font-mono" style="text-align: right;">${this.fmt(h.saida, 0)}</td>
                    <td class="font-mono" style="text-align: center;">${h.qtdCarros}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background: rgba(255,255,255,0.06); font-weight: 700;">
                  <td>Total Hoje</td>
                  <td class="font-mono" style="text-align: right; color: #38bdf8;">${this.fmt(totHid.prod, 0)}</td>
                  <td class="font-mono" style="text-align: right;">${this.fmt(totHid.saida, 0)}</td>
                  <td class="font-mono" style="text-align: center;">${totHid.carros}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- 2. Álcool Anidro -->
        <div class="section-card">
          <div class="section-header" style="background: rgba(251, 191, 36, 0.1); border-bottom: 1px solid rgba(251, 191, 36, 0.2);">
            <div class="section-title" style="color: #fbbf24;">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span>Álcool Anidro (m³) - Hoje</span>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table mini">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th style="text-align: right;">Produção</th>
                  <th style="text-align: right;">Saída</th>
                  <th style="text-align: center;">Carros</th>
                </tr>
              </thead>
              <tbody>
                ${horarioAnidro.map(h => `
                  <tr>
                    <td class="font-mono">${h.descricao}</td>
                    <td class="font-mono" style="text-align: right;">${this.fmt(h.producao, 0)}</td>
                    <td class="font-mono" style="text-align: right;">${this.fmt(h.saida, 0)}</td>
                    <td class="font-mono" style="text-align: center;">${h.qtdCarros}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background: rgba(255,255,255,0.06); font-weight: 700;">
                  <td>Total Hoje</td>
                  <td class="font-mono" style="text-align: right; color: #fbbf24;">${this.fmt(totAni.prod, 0)}</td>
                  <td class="font-mono" style="text-align: right;">${this.fmt(totAni.saida, 0)}</td>
                  <td class="font-mono" style="text-align: center;">${totAni.carros}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- 3. Açúcar -->
        <div class="section-card">
          <div class="section-header" style="background: rgba(16, 185, 129, 0.1); border-bottom: 1px solid rgba(16, 185, 129, 0.2);">
            <div class="section-title" style="color: #34d399;">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
              <span>Açúcar (scs 50kg) - Hoje</span>
            </div>
          </div>
          <div class="table-responsive">
            <table class="data-table mini">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th style="text-align: right;">Produção</th>
                  <th style="text-align: right;">Saída</th>
                  <th style="text-align: center;">Carros</th>
                </tr>
              </thead>
              <tbody>
                ${horarioAcucar.map(h => `
                  <tr>
                    <td class="font-mono">${h.descricao}</td>
                    <td class="font-mono" style="text-align: right; color: #34d399;">${this.fmt(h.producao, 0)}</td>
                    <td class="font-mono" style="text-align: right;">${this.fmt(h.saida, 0)}</td>
                    <td class="font-mono" style="text-align: center;">${h.qtdCarros}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="background: rgba(255,255,255,0.06); font-weight: 700;">
                  <td>Total Hoje</td>
                  <td class="font-mono" style="text-align: right; color: #34d399;">${this.fmt(totAcu.prod, 0)}</td>
                  <td class="font-mono" style="text-align: right;">${this.fmt(totAcu.saida, 0)}</td>
                  <td class="font-mono" style="text-align: center;">${totAcu.carros}</td>
                </tr>
                <tr style="background: rgba(16, 185, 129, 0.15); font-weight: 800;">
                  <td>Total Safra</td>
                  <td class="font-mono" style="text-align: right; color: #34d399;">${this.fmt(totaisSafra.acucarProducao, 0)}</td>
                  <td class="font-mono" style="text-align: right;">${this.fmt(totaisSafra.acucarSaida, 0)}</td>
                  <td class="font-mono" style="text-align: center;">${totaisSafra.acucarCarros}</td>
                </tr>
              </tfoot>
            </table>
          </div>
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

// View do Módulo Produção Semanal
const ProducaoSemanalView = {
  async render(container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
        <div class="live-dot" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
        <p>Carregando fechamentos semanais da Safra 54...</p>
      </div>
    `;

    const data = await API.getProducaoSemanal();
    if (!data) {
      container.innerHTML = '<p style="color: var(--accent-rose); padding: 2rem;">Erro ao carregar dados de produção semanal.</p>';
      return;
    }

    const { semanas = [] } = data;

    const html = `
      <div class="section-card">
        <div class="section-header" style="justify-content: space-between;">
          <div class="section-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            <span>Mapa de Produção Semanal e Saída de Produtos</span>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Posição em <b>${data.dathor || ''}</b></span>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Semana / Período</th>
                <th style="text-align: right;">Cana Entrada (t)</th>
                <th style="text-align: right;">Cana Moída (t)</th>
                <th style="text-align: right;">Efic (%)</th>
                <th style="text-align: right;">PCC (%)</th>
                <th style="text-align: right;">ATR (kg/t)</th>
                <th style="text-align: right;">Pureza (%)</th>
                <th style="text-align: right;">Fibra (%)</th>
                <th style="text-align: center;">TQ</th>
                <th style="text-align: right;">Prod. Equiv. (scs)</th>
                <th style="text-align: right;">Hidratado (L)</th>
                <th style="text-align: right;">Anidro (L)</th>
                <th style="text-align: right; color: #34d399;">Açúcar (scs)</th>
              </tr>
            </thead>
            <tbody>
              ${semanas.map((row, idx) => `
                <tr style="${idx === 0 ? 'background: rgba(16, 185, 129, 0.08); font-weight: 600;' : ''}">
                  <td style="font-weight: 700; color: ${idx === 0 ? '#34d399' : 'var(--text-light)'};">
                    <b>${row.sem}</b> <span style="font-size: 0.78rem; color: var(--text-muted); font-weight: 400;">(${row.periodo})</span>
                  </td>
                  <td class="font-mono" style="text-align: right;">${this.fmt(row.canaEntrada, 3)}</td>
                  <td class="font-mono" style="text-align: right; color: #38bdf8;">${this.fmt(row.canaMoida, 3)}</td>
                  <td class="font-mono" style="text-align: right; color: ${row.eficiencia >= 80 ? '#34d399' : '#fbbf24'};">${this.fmt(row.eficiencia, 0)}%</td>
                  <td class="font-mono" style="text-align: right;">${row.pcc !== null ? this.fmt(row.pcc, 4) : '-'}</td>
                  <td class="font-mono" style="text-align: right; font-weight: 700; color: #fbbf24;">${row.atr !== null ? this.fmt(row.atr, 4) : '-'}</td>
                  <td class="font-mono" style="text-align: right;">${row.pureza !== null ? this.fmt(row.pureza, 4) : '-'}</td>
                  <td class="font-mono" style="text-align: right;">${row.fibra !== null ? this.fmt(row.fibra, 4) : '-'}</td>
                  <td class="font-mono" style="text-align: center; color: var(--text-muted);">${row.tq || '-'}</td>
                  <td class="font-mono" style="text-align: right; color: #38bdf8;">${row.prodEquiv !== null ? this.fmt(row.prodEquiv, 0) : '-'}</td>
                  <td class="font-mono" style="text-align: right;">${row.prodHidratado !== null ? this.fmt(row.prodHidratado, 0) : '-'}</td>
                  <td class="font-mono" style="text-align: right;">${row.prodAnidro !== null ? this.fmt(row.prodAnidro, 0) : '-'}</td>
                  <td class="font-mono" style="text-align: right; font-weight: 700; color: #34d399;">${row.prodAcucar !== null ? this.fmt(row.prodAcucar, 0) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
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
