// Controle de acesso por dispositivo: identificação no primeiro acesso, espera pela liberação
// e painel de administração (dispositivos marcados como administrador).

const Acesso = {
  estado: null,
  pollTimer: null,
  adminTimer: null,
  filtroAdmin: null,

  // Retorna true quando o dispositivo pode usar o sistema
  async iniciar() {
    this.interceptarFetch();
    const st = await this.buscarStatus();
    this.estado = st;
    if (st.status === 'aprovado') {
      if (st.admin) this.ativarAdmin();
      return true;
    }
    this.mostrarTela(st);
    return false;
  },

  async buscarStatus() {
    try {
      const res = await fetch('/api/acesso/status', { cache: 'no-store' });
      return await res.json();
    } catch (err) {
      return { status: 'indisponivel' };
    }
  },

  // Se o dispositivo for bloqueado com o sistema aberto, a próxima chamada de dados cai aqui
  interceptarFetch() {
    if (this._fetchOriginal) return;
    const original = window.fetch.bind(window);
    this._fetchOriginal = original;
    window.fetch = async (...args) => {
      const res = await original(...args);
      const url = String(args[0] && args[0].url ? args[0].url : args[0]);
      if ([401, 403].includes(res.status) && url.includes('/api/') && !url.includes('/api/acesso/')) {
        try {
          const corpo = await res.clone().json();
          if (corpo && ['nao_identificado', 'pendente', 'bloqueado'].includes(corpo.acesso)) {
            this.mostrarTela(await this.buscarStatus());
          }
        } catch (e) { /* resposta não-JSON */ }
      }
      return res;
    };
  },

  esc(txt) {
    return String(txt ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // Sugestão de nome para o dispositivo a partir do navegador
  sugerirDescricao() {
    const ua = navigator.userAgent;
    if (/SmartTV|SMART-TV|Tizen|Web0S|webOS|NetCast|BRAVIA|AFT|GoogleTV|Android TV|HbbTV/i.test(ua)) return 'Smart TV';
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Celular Android' : 'Tablet Android';
    if (/Windows/i.test(ua)) return 'Computador Windows';
    if (/Macintosh/i.test(ua)) return 'Mac';
    if (/Linux/i.test(ua)) return 'Computador Linux';
    return '';
  },

  overlay() {
    let el = document.getElementById('acesso-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'acesso-overlay';
      el.className = 'acesso-overlay';
      document.body.appendChild(el);
    }
    document.body.classList.add('acesso-bloqueado');
    return el;
  },

  mostrarTela(st) {
    this.estado = st;
    clearInterval(this.pollTimer);
    const el = this.overlay();
    const cabecalho = `
      <img src="Logo.png" alt="Usina Porto Rico" class="acesso-logo" />
      <h1>Boletim Online de Moagem</h1>`;

    if (st.status === 'nao_identificado') {
      el.innerHTML = `
        <div class="acesso-card">
          ${cabecalho}
          <p class="acesso-texto">Este dispositivo ainda não está liberado. Identifique-se para solicitar o acesso;
            depois de liberado, você não precisará fazer isso de novo neste dispositivo.</p>
          <form id="acesso-form" class="acesso-form" autocomplete="on">
            <label>Seu nome *<input name="nome" required minlength="3" maxlength="100" autocomplete="name" /></label>
            <label>Setor / função<input name="setor" maxlength="100" autocomplete="organization-title" /></label>
            <label>Telefone ou e-mail<input name="contato" maxlength="100" autocomplete="tel" /></label>
            <label>Identificação deste dispositivo *
              <input name="descricao" required minlength="2" maxlength="100" value="${this.esc(this.sugerirDescricao())}"
                     placeholder="Ex.: Celular do João, TV da Sala de Controle" />
            </label>
            ${st.codigoDisponivel ? `
              <details class="acesso-codigo">
                <summary>Tenho um código de liberação</summary>
                <label>Código<input name="codigo" type="password" maxlength="200" autocomplete="off" /></label>
              </details>` : ''}
            <div id="acesso-erro" class="acesso-erro" role="alert"></div>
            <button type="submit" class="acesso-botao">Solicitar acesso</button>
          </form>
        </div>`;
      document.getElementById('acesso-form').addEventListener('submit', (e) => this.enviar(e));
      return;
    }

    if (st.status === 'pendente') {
      el.innerHTML = `
        <div class="acesso-card">
          ${cabecalho}
          <div class="acesso-icone">⏳</div>
          <h2>Aguardando liberação</h2>
          <p class="acesso-texto">Solicitação de <b>${this.esc(st.nome)}</b> para o dispositivo
            <b>${this.esc(st.descricao)}</b> enviada. Assim que o administrador liberar, o sistema abre sozinho.</p>
          <p class="acesso-nota">Verificando automaticamente a cada 30 segundos…</p>
        </div>`;
      this.pollTimer = setInterval(async () => {
        const novo = await this.buscarStatus();
        if (novo.status === 'aprovado') location.reload();
        else if (novo.status !== 'pendente' && novo.status !== 'indisponivel') this.mostrarTela(novo);
      }, 30000);
      return;
    }

    if (st.status === 'bloqueado') {
      el.innerHTML = `
        <div class="acesso-card">
          ${cabecalho}
          <div class="acesso-icone">⛔</div>
          <h2>Acesso bloqueado</h2>
          <p class="acesso-texto">Este dispositivo não está autorizado a acessar o sistema.
            Procure o administrador se achar que isso é um engano.</p>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="acesso-card">
        ${cabecalho}
        <div class="acesso-icone">📡</div>
        <h2>Não foi possível verificar o acesso</h2>
        <p class="acesso-texto">O servidor de dados não respondeu. Tentando novamente…</p>
      </div>`;
    this.pollTimer = setInterval(async () => {
      const novo = await this.buscarStatus();
      if (novo.status === 'aprovado') location.reload();
      else if (novo.status !== 'indisponivel') this.mostrarTela(novo);
    }, 30000);
  },

  async enviar(e) {
    e.preventDefault();
    const form = e.target;
    const botao = form.querySelector('button[type="submit"]');
    const erro = document.getElementById('acesso-erro');
    const dados = Object.fromEntries(new FormData(form).entries());
    erro.textContent = '';
    botao.disabled = true;
    botao.textContent = 'Enviando…';
    try {
      const res = await fetch('/api/acesso/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      const r = await res.json();
      if (res.ok && r.status === 'aprovado') {
        location.reload();
        return;
      }
      if (!res.ok && res.status !== 409) throw new Error(r.error || 'Falha ao enviar a solicitação.');
      if (r.codigoInvalido) {
        alert('Código de liberação inválido. Sua solicitação foi registrada e aguarda liberação do administrador.');
      }
      this.mostrarTela(await this.buscarStatus());
    } catch (err) {
      erro.textContent = err.message;
      botao.disabled = false;
      botao.textContent = 'Solicitar acesso';
    }
  },

  // --- ADMINISTRAÇÃO ---------------------------------------------------------------------

  ativarAdmin() {
    const btn = document.getElementById('btn-acesso-admin');
    if (!btn) return;
    btn.style.display = 'flex';
    this.atualizarPendentes();
    this.adminTimer = setInterval(() => this.atualizarPendentes(), 60000);
  },

  async listar() {
    const res = await fetch('/api/acesso/dispositivos', { cache: 'no-store' });
    if (!res.ok) throw new Error('Não foi possível carregar os dispositivos.');
    return (await res.json()).dispositivos;
  },

  async atualizarPendentes() {
    try {
      const n = (await this.listar()).filter(d => d.status === 'pendente').length;
      const badge = document.getElementById('acesso-admin-badge');
      if (badge) {
        badge.textContent = n;
        badge.style.display = n > 0 ? 'flex' : 'none';
      }
      const btn = document.getElementById('btn-acesso-admin');
      if (btn) btn.title = n > 0 ? `${n} dispositivo(s) aguardando liberação` : 'Dispositivos com acesso';
      return n;
    } catch (e) {
      return 0;
    }
  },

  async abrirAdmin() {
    Modal.open({
      title: 'Dispositivos com acesso ao sistema',
      width: '1100px',
      htmlContent: '<div id="acesso-admin"><p class="acesso-nota" style="text-align:center;padding:2rem;">Carregando…</p></div>'
    });
    await this.renderAdmin();
  },

  async renderAdmin() {
    const el = document.getElementById('acesso-admin');
    if (!el) return;
    let lista;
    try {
      lista = await this.listar();
    } catch (err) {
      el.innerHTML = `<p style="color: var(--accent-rose); text-align: center; padding: 2rem;">${this.esc(err.message)}</p>`;
      return;
    }
    const cont = { pendente: 0, aprovado: 0, bloqueado: 0 };
    lista.forEach(d => { cont[d.status] = (cont[d.status] || 0) + 1; });
    if (!this.filtroAdmin) this.filtroAdmin = cont.pendente > 0 ? 'pendente' : 'todos';
    const filtrados = this.filtroAdmin === 'todos' ? lista : lista.filter(d => d.status === this.filtroAdmin);

    const aba = (id, rotulo, n) => `
      <button class="acesso-filtro ${this.filtroAdmin === id ? 'ativo' : ''}" onclick="Acesso.filtrar('${id}')">
        ${rotulo}${n !== undefined ? ` <span>${n}</span>` : ''}</button>`;

    const rotuloStatus = { pendente: 'Aguardando', aprovado: 'Liberado', bloqueado: 'Bloqueado' };
    const cards = filtrados.map(d => `
      <div class="acesso-disp acesso-disp-${d.status}">
        <div class="acesso-disp-topo">
          <b>${this.esc(d.nome)}</b>
          <span class="acesso-status">${rotuloStatus[d.status] || d.status}${d.admin ? ' · Admin' : ''}</span>
        </div>
        <div class="acesso-disp-desc">📱 ${this.esc(d.descricao)}${d.atual ? ' <em>(este dispositivo)</em>' : ''}</div>
        ${d.setor || d.contato ? `<div class="acesso-disp-linha">${this.esc([d.setor, d.contato].filter(Boolean).join(' · '))}</div>` : ''}
        <div class="acesso-disp-linha">Pedido em ${this.esc(d.dataCadastro)}${d.ipCadastro ? ` · IP ${this.esc(d.ipCadastro)}` : ''}</div>
        ${d.ultimoAcesso ? `<div class="acesso-disp-linha">Último acesso ${this.esc(d.ultimoAcesso)}</div>` : ''}
        ${d.alteradoPor ? `<div class="acesso-disp-linha">${d.status === 'bloqueado' ? 'Bloqueado' : 'Alterado'} por ${this.esc(d.alteradoPor)} em ${this.esc(d.dataAlteracaoStatus)}</div>` : ''}
        <div class="acesso-disp-ua" title="${this.esc(d.userAgent)}">${this.esc(d.userAgent || '')}</div>
        ${d.atual ? '' : `
        <div class="acesso-acoes">
          ${d.status !== 'aprovado' ? `<button class="acesso-acao liberar" onclick="Acesso.acao(${d.id}, 'aprovar')">Liberar</button>` : ''}
          ${d.status !== 'bloqueado' ? `<button class="acesso-acao bloquear" onclick="Acesso.acao(${d.id}, 'bloquear')">Bloquear</button>` : ''}
          ${d.status === 'aprovado' ? `<button class="acesso-acao" onclick="Acesso.acao(${d.id}, 'admin', ${!d.admin})">${d.admin ? 'Remover admin' : 'Tornar admin'}</button>` : ''}
          <button class="acesso-acao excluir" onclick="Acesso.acao(${d.id}, 'excluir')">Excluir</button>
        </div>`}
      </div>`).join('');

    el.innerHTML = `
      ${typeof Assistente !== 'undefined' ? Assistente.controleAdmin() : ''}
      <div class="acesso-filtros">
        ${aba('pendente', 'Aguardando', cont.pendente)}
        ${aba('aprovado', 'Liberados', cont.aprovado)}
        ${aba('bloqueado', 'Bloqueados', cont.bloqueado)}
        ${aba('todos', 'Todos', lista.length)}
      </div>
      <div class="acesso-lista">
        ${cards || '<p class="acesso-nota" style="padding: 1.5rem; text-align: center;">Nenhum dispositivo nesta situação.</p>'}
      </div>`;
  },

  filtrar(filtro) {
    this.filtroAdmin = filtro;
    this.renderAdmin();
  },

  async acao(id, tipo, valor) {
    const confirmar = { bloquear: 'Bloquear este dispositivo? Ele perde o acesso imediatamente.',
                        excluir: 'Excluir este dispositivo da lista? Se ele voltar, precisará pedir acesso de novo.' };
    if (confirmar[tipo] && !confirm(confirmar[tipo])) return;

    const rota = tipo === 'excluir' ? `/api/acesso/dispositivos/${id}` : `/api/acesso/dispositivos/${id}/${tipo}`;
    try {
      const res = await fetch(rota, {
        method: tipo === 'excluir' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tipo === 'admin' ? { admin: valor } : {})
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || 'Não foi possível concluir a ação.');
    } catch (err) {
      alert(err.message);
    }
    await this.renderAdmin();
    this.atualizarPendentes();
  }
};
