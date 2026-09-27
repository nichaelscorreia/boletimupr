// Aplicação Principal - Boletim Online de Moagem 2.0

const App = {
  currentTab: 'agricola',
  refreshInterval: null,

  init() {
    this.setupClock();
    Drawer.init();
    Modal.init();
    TVController.init();

    // Iniciar na aba Agrícola por padrão (conforme requisito)
    this.switchTab('agricola');
    this.initTheme();
    this.setupNavHint();

    // Atualização periódica dos dados a cada 90 segundos
    this.refreshInterval = setInterval(() => {
      this.refreshCurrentView();
    }, 90000);

    // Atalhos de Teclado
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' && !Drawer.isOpen() && !Modal.isOpen()) {
        this.navigateTab(1);
      } else if (e.key === 'ArrowLeft' && !Drawer.isOpen() && !Modal.isOpen()) {
        this.navigateTab(-1);
      }
    });

    console.log('🌱 Boletim Online de Moagem Inicializado com Sucesso.');
  },

  initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  },

  toggleTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  },

  // Mostra setas nas bordas do menu quando há opções escondidas (celular) e dá uma "puxadinha"
  // no menu na primeira visita, para o usuário perceber que ele rola para o lado
  setupNavHint() {
    const wrap = document.getElementById('nav-wrap');
    const nav = document.getElementById('nav-container');
    if (!wrap || !nav) return;

    const update = () => {
      const max = nav.scrollWidth - nav.clientWidth;
      wrap.classList.toggle('can-left', nav.scrollLeft > 4);
      wrap.classList.toggle('can-right', nav.scrollLeft < max - 4);
    };
    nav.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();

    let jaViu = false;
    try { jaViu = localStorage.getItem('navHintSeen') === '1'; } catch (e) { /* storage indisponível */ }
    if (!jaViu && nav.scrollWidth > nav.clientWidth) {
      setTimeout(() => {
        nav.scrollTo({ left: 90, behavior: 'smooth' });
        setTimeout(() => nav.scrollTo({ left: 0, behavior: 'smooth' }), 700);
      }, 1200);
      try { localStorage.setItem('navHintSeen', '1'); } catch (e) { /* storage indisponível */ }
    }
  },

  scrollNav(direction) {
    const nav = document.getElementById('nav-container');
    if (nav) nav.scrollBy({ left: direction * nav.clientWidth * 0.7, behavior: 'smooth' });
  },

  setupClock() {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const el = document.getElementById('live-clock');
      if (el) el.innerHTML = `<span>${dateStr}</span> <b>${timeStr}</b>`;
    };
    updateTime();
    setInterval(updateTime, 1000);
  },

  switchTab(tabId) {
    this.currentTab = tabId;

    // Atualizar botões de navegação
    document.querySelectorAll('.nav-tab').forEach(btn => {
      const target = btn.getAttribute('data-tab');
      if (target === tabId) {
        btn.classList.add('active');
        btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      } else {
        btn.classList.remove('active');
      }
    });

    // Renderizar a view correspondente
    this.refreshCurrentView();
  },

  navigateTab(direction) {
    const tabs = ['agricola', 'industria', 'producao', 'producao-semanal', 'frota', 'frota-disponibilidade', 'laboratorio'];
    let idx = tabs.indexOf(this.currentTab);
    idx = (idx + direction + tabs.length) % tabs.length;
    this.switchTab(tabs[idx]);
  },

  async refreshCurrentView() {
    const container = document.getElementById('main-view-container');
    if (!container) return;

    // Efeito de transição suave
    container.classList.remove('slide-transition');
    void container.offsetWidth; // trigger reflow
    container.classList.add('slide-transition');

    switch (this.currentTab) {
      case 'agricola':
        await AgricolaView.render(container);
        break;
      case 'industria':
        await IndustriaView.render(container);
        break;
      case 'producao':
        if (typeof ProducaoView.render === 'function') await ProducaoView.render(container);
        else if (typeof ProducaoView.renderDiaria === 'function') await ProducaoView.renderDiaria(container);
        break;
      case 'producao-semanal':
        if (typeof ProducaoSemanalView !== 'undefined' && typeof ProducaoSemanalView.render === 'function') await ProducaoSemanalView.render(container);
        else if (typeof ProducaoView.renderSemanal === 'function') await ProducaoView.renderSemanal(container);
        break;
      case 'frota':
        if (typeof FrotaView.render === 'function') await FrotaView.render(container);
        else if (typeof FrotaView.renderProdutividade === 'function') await FrotaView.renderProdutividade(container);
        break;
      case 'frota-disponibilidade':
        if (typeof DisponibilidadeFrotaView !== 'undefined' && typeof DisponibilidadeFrotaView.render === 'function') await DisponibilidadeFrotaView.render(container);
        else if (typeof FrotaView.renderDisponibilidade === 'function') await FrotaView.renderDisponibilidade(container);
        break;
      case 'laboratorio':
        if (typeof LaboratorioView !== 'undefined' && typeof LaboratorioView.render === 'function') await LaboratorioView.render(container);
        else if (typeof ComplementaresView !== 'undefined' && typeof ComplementaresView.renderLaboratorio === 'function') await ComplementaresView.renderLaboratorio(container);
        break;
      default:
        await AgricolaView.render(container);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
