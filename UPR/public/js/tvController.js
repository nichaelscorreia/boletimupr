// Gerenciador do Modo TV Corporativa (Gestão à Vista & Auto-Rotação)

const TVController = {
  isActive: false,
  isPaused: false,
  timerInterval: null,
  currentTabIdx: 0,
  timeElapsed: 0,
  durationSeconds: 210, // 3.5 minutos (210s) por padrão

  // Sequência de telas ativas para rotação automática na TV
  tabsSequence: [
    { id: 'agricola', duration: 210 },
    { id: 'industria', duration: 210 },
    { id: 'producao', duration: 210 },
    { id: 'producao-semanal', duration: 210 },
    { id: 'frota', duration: 210 },
    { id: 'frota-disponibilidade', duration: 210 },
    { id: 'laboratorio', duration: 210 }
  ],

  init() {
    this.setupListeners();
  },

  // true quando a tecla foi pressionada dentro de um campo de texto
  digitando(e) {
    const el = e.target;
    return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
  },

  setDuration(seconds) {
    const s = parseInt(seconds, 10) || 210;
    this.durationSeconds = s;
    this.tabsSequence.forEach(t => t.duration = s);
    if (this.isActive) {
      this.timeElapsed = 0;
      this.startTimer();
    }
  },

  setupListeners() {
    // Tecla espaço para pausar/retomar rotação
    document.addEventListener('keydown', (e) => {
      // Atalhos não valem enquanto o usuário digita (ex.: espaço no campo de pergunta do assistente)
      if (TVController.digitando(e)) return;
      if (e.code === 'Space' && this.isActive && !Drawer.isOpen() && !Modal.isOpen()) {
        e.preventDefault();
        this.togglePause();
      }
      if (e.key === 'F11' || (e.key === 'f' && e.ctrlKey)) {
        this.toggleFullscreen();
      }
    });

    // Auto-hide cursor em TVs após 3s sem movimento
    let cursorTimer;
    document.addEventListener('mousemove', () => {
      if (this.isActive) {
        document.body.style.cursor = 'default';
        clearTimeout(cursorTimer);
        cursorTimer = setTimeout(() => {
          if (this.isActive) document.body.style.cursor = 'none';
        }, 3000);
      }
    });
  },

  toggle() {
    this.isActive = !this.isActive;
    const btn = document.getElementById('btn-tv-auto');
    const linearProgress = document.getElementById('tv-linear-progress');

    if (this.isActive) {
      document.body.classList.add('tv-mode');
      if (btn) {
        btn.classList.add('active');
        btn.innerHTML = `
          <div class="tv-progress-circle">
            <svg viewBox="0 0 18 18">
              <circle class="tv-progress-bg" cx="9" cy="9" r="7"></circle>
              <circle id="tv-progress-bar" class="tv-progress-bar" cx="9" cy="9" r="7"></circle>
            </svg>
          </div>
          <span>Auto-Rotação: <b>Ativa</b></span>
        `;
      }
      if (linearProgress) linearProgress.style.display = 'block';
      this.startTimer();
      this.requestFullscreenSafe();
    } else {
      document.body.classList.remove('tv-mode');
      if (btn) {
        btn.classList.remove('active');
        btn.innerHTML = `
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Atualiz. Automática</span>
        `;
      }
      if (linearProgress) linearProgress.style.display = 'none';
      this.stopTimer();
    }
  },

  startTimer() {
    this.stopTimer();
    this.timeElapsed = 0;
    const currentTabObj = this.tabsSequence[this.currentTabIdx] || this.tabsSequence[0];
    this.durationSeconds = currentTabObj.duration || 40;

    this.timerInterval = setInterval(() => {
      if (this.isPaused || Drawer.isOpen() || Modal.isOpen() || (typeof Assistente !== 'undefined' && Assistente.isOpen())) return;

      this.timeElapsed += 1;
      const progressPercent = Math.min(100, (this.timeElapsed / this.durationSeconds) * 100);

      // Atualizar barra linear
      const linearFill = document.getElementById('tv-linear-progress-fill');
      if (linearFill) linearFill.style.width = `${progressPercent}%`;

      // Atualizar círculo de progresso
      const circularBar = document.getElementById('tv-progress-bar');
      if (circularBar) {
        const offset = 44 - (44 * progressPercent) / 100;
        circularBar.style.strokeDashoffset = offset;
      }

      if (this.timeElapsed >= this.durationSeconds) {
        this.nextSlide();
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  nextSlide() {
    this.currentTabIdx = (this.currentTabIdx + 1) % this.tabsSequence.length;
    const target = this.tabsSequence[this.currentTabIdx];
    App.switchTab(target.id);
    this.startTimer();
  },

  togglePause() {
    this.isPaused = !this.isPaused;
    const toast = document.getElementById('tv-toast');
    if (toast) {
      toast.innerText = this.isPaused ? '⏸️ Rotação Pausada' : '▶️ Rotação Retomada';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
    } else {
      document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
    }
  },

  requestFullscreenSafe() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
  }
};
