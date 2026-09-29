// View do Módulo Laboratório (Indicadores Industriais - Painel Industrial TV)

const LaboratorioView = {
  clockInterval: null,

  async render(container) {
    if (this.clockInterval) clearInterval(this.clockInterval);

    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
        <div class="live-dot" style="margin: 0 auto 1rem; width: 14px; height: 14px;"></div>
        <p>Carregando indicadores laboratoriais e industriais em tempo real...</p>
      </div>
    `;

    const data = await API.getLaboratorio();
    if (!data) {
      container.innerHTML = '<p style="color: var(--accent-rose); padding: 2rem;">Erro ao carregar dados do laboratório.</p>';
      return;
    }

    const { cards = [] } = data;

    const html = `
      <div style="margin-bottom: 1.25rem;">
        <div class="section-header" style="justify-content: space-between; margin-bottom: 1rem;">
          <div class="section-title">
            <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
            <span style="font-size: 1.25rem; font-weight: 800; letter-spacing: 0.5px;">Indicadores Industriais (Laboratório)</span>
          </div>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Posição em <b>${data.dathor || ''}</b></span>
        </div>

        <!-- GRID DE 15 CARDS (1 RELÓGIO + 14 INDICADORES) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
          
          <!-- CARD 1: RELÓGIO HOJE -->
          <div class="indicador-card normal" style="background: linear-gradient(145deg, #064e3b 0%, #022c22 100%); border: 1px solid rgba(16,185,129,0.3); border-radius: 10px; padding: 0.75rem; text-align: center; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <div style="background: #047857; color: white; font-weight: 800; padding: 0.35rem 0.5rem; border-radius: 6px; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">
              Hoje
            </div>
            
            <div style="display: flex; justify-content: center; align-items: center; padding: 0.5rem 0;">
              <svg id="analog-clock" width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="#f8fafc" stroke="#334155" stroke-width="3"/>
                <!-- Horas markers -->
                ${Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i * 30) * (Math.PI / 180);
                  const x1 = 50 + 38 * Math.sin(angle);
                  const y1 = 50 - 38 * Math.cos(angle);
                  const x2 = 50 + 44 * Math.sin(angle);
                  const y2 = 50 - 44 * Math.cos(angle);
                  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e293b" stroke-width="${i % 3 === 0 ? '3' : '1.5'}"/>`;
                }).join('')}
                <line id="clock-hour" x1="50" y1="50" x2="50" y2="26" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
                <line id="clock-min" x1="50" y1="50" x2="50" y2="16" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>
                <line id="clock-sec" x1="50" y1="50" x2="50" y2="12" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="50" cy="50" r="3.5" fill="#f59e0b"/>
              </svg>
            </div>

            <div style="font-family: monospace; font-size: 0.95rem; font-weight: 700; color: #a7f3d0;" id="digital-clock-time">
              --:--:--
            </div>
          </div>

          <!-- CARDS 2 A 15: INDICADORES INDUSTRIAIS -->
          ${cards.map(c => {
            const isAlerta = c.status === 'alerta';
            const bgGrad = isAlerta 
              ? 'linear-gradient(145deg, #881337 0%, #4c0519 100%)' 
              : 'linear-gradient(145deg, #064e3b 0%, #022c22 100%)';
            const borderCol = isAlerta ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.3)';
            const headerBg = isAlerta ? '#be123c' : '#047857';
            const valueCol = isAlerta ? '#ffffff' : '#ffffff';

            // Percentual para o pill bar de referência
            let pillPercent = 50;
            if (c.refMax > c.refMin) {
              pillPercent = Math.min(100, Math.max(0, ((c.hoje - c.refMin) / (c.refMax - c.refMin)) * 100));
            }

            return `
              <div class="indicador-card ${c.status}" style="background: ${bgGrad}; border: 1px solid ${borderCol}; border-radius: 10px; padding: 0.75rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <!-- Header -->
                <div style="background: ${headerBg}; color: white; font-weight: 800; padding: 0.35rem 0.5rem; border-radius: 6px; font-size: 0.85rem; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${c.titulo}
                </div>

                <!-- 3 Values: Ontem, Hoje, Safra -->
                <div style="display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: center; text-align: center; padding: 0.6rem 0;">
                  <div>
                    <div style="font-size: 0.68rem; color: rgba(255,255,255,0.7); text-transform: uppercase;">Ontem</div>
                    <div class="font-mono" style="font-size: 0.85rem; color: rgba(255,255,255,0.9); font-weight: 600;">${this.fmt(c.ontem, c.formatoDecimais)}</div>
                  </div>

                  <div style="padding: 0 0.25rem;">
                    <div class="font-mono" style="font-size: 1.6rem; font-weight: 900; color: ${valueCol}; line-height: 1.1;">
                      ${this.fmt(c.hoje, c.formatoDecimais)}
                    </div>
                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8); font-weight: 700; margin-top: 0.15rem;">
                      ${c.unidade}
                    </div>
                  </div>

                  <div>
                    <div style="font-size: 0.68rem; color: rgba(255,255,255,0.7); text-transform: uppercase;">Safra</div>
                    <div class="font-mono" style="font-size: 0.85rem; color: rgba(255,255,255,0.9); font-weight: 600;">${this.fmt(c.safra, c.formatoDecimais)}</div>
                  </div>
                </div>

                <!-- Reference Pill & Range -->
                <div>
                  <div style="background: rgba(0,0,0,0.3); border-radius: 10px; height: 12px; position: relative; overflow: hidden; margin-bottom: 0.35rem; border: 1px solid rgba(255,255,255,0.15);">
                    <div style="width: ${pillPercent}%; height: 100%; background: ${isAlerta ? 'linear-gradient(90deg, #f43f5e, #fda4af)' : 'linear-gradient(90deg, #10b981, #6ee7b7)'}; border-radius: 10px; transition: width 0.5s ease;"></div>
                  </div>
                  <div style="font-size: 0.72rem; color: rgba(255,255,255,0.85); font-weight: 600; text-align: center;">
                    ${c.refTexto}
                  </div>
                </div>
              </div>
            `;
          }).join('')}

        </div>
      </div>
    `;

    container.innerHTML = html;

    // Iniciar animação do relógio analógico e digital
    this.startClock();
  },

  startClock() {
    const update = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      const secAngle = seconds * 6;
      const minAngle = minutes * 6 + seconds * 0.1;
      const hourAngle = (hours % 12) * 30 + minutes * 0.5;

      const secHand = document.getElementById('clock-sec');
      const minHand = document.getElementById('clock-min');
      const hourHand = document.getElementById('clock-hour');
      const dig = document.getElementById('digital-clock-time');

      if (secHand) {
        const rad = secAngle * (Math.PI / 180);
        secHand.setAttribute('x2', 50 + 38 * Math.sin(rad));
        secHand.setAttribute('y2', 50 - 38 * Math.cos(rad));
      }
      if (minHand) {
        const rad = minAngle * (Math.PI / 180);
        minHand.setAttribute('x2', 50 + 32 * Math.sin(rad));
        minHand.setAttribute('y2', 50 - 32 * Math.cos(rad));
      }
      if (hourHand) {
        const rad = hourAngle * (Math.PI / 180);
        hourHand.setAttribute('x2', 50 + 24 * Math.sin(rad));
        hourHand.setAttribute('y2', 50 - 24 * Math.cos(rad));
      }
      if (dig) {
        const pad = n => String(n).padStart(2, '0');
        dig.innerText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      }
    };

    update();
    this.clockInterval = setInterval(update, 1000);
  },

  fmt(val, dec = 2) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
};

const ComplementaresView = {
  renderLaboratorio(container) {
    return LaboratorioView.render(container);
  }
};
