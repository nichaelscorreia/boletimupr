// Administração do envio dos relatórios dos fretistas pelo WhatsApp (só para dispositivos administradores).
// Cadastro número <-> fornecedor, horário do envio diário e envio de teste. Os dados ficam no Oracle da usina.
const Whatsapp = {
  estado: null,
  fornecedores: null,

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // 5582991142153 -> (82) 99114-2153
  fone(n) {
    const d = String(n || '').replace(/\D/g, '').replace(/^55/, '');
    return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}` : n;
  },

  async chamar(caminho, corpo) {
    const res = await fetch(`/api/whatsapp${caminho}`, corpo === undefined ? { cache: 'no-store' } : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
    });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(r.error || 'Não foi possível concluir a ação.');
    return r;
  },

  // O botão só aparece para quem pode administrar (a rota responde 403 para os demais)
  async iniciar() {
    const btn = document.getElementById('btn-whatsapp-admin');
    if (!btn) return;
    try {
      const res = await fetch('/api/whatsapp/permissao', { cache: 'no-store' });
      if (res.ok) btn.style.display = 'flex';
    } catch (e) { /* sem rede: mantém escondido */ }
  },

  async abrir() {
    Modal.open({
      title: 'WhatsApp dos fretistas',
      width: '1000px',
      htmlContent: '<div id="wpp-admin"><p class="acesso-nota" style="text-align:center;padding:2rem;">Carregando…</p></div>'
    });
    await this.render();
    if (!this.fornecedores) {
      this.chamar('/fornecedores').then(l => { this.fornecedores = l; this.preencherFornecedores(); }).catch(() => {});
    }
  },

  preencherFornecedores() {
    const dl = document.getElementById('wpp-fornecedores');
    if (dl && this.fornecedores) {
      dl.innerHTML = this.fornecedores.map(f => `<option value="${f.codFornecedor}">${this.esc(f.nome)}</option>`).join('');
    }
  },

  async render(aviso) {
    const el = document.getElementById('wpp-admin');
    if (!el) return;
    let st;
    try {
      st = this.estado = await this.chamar('');
    } catch (err) {
      el.innerHTML = `<p style="color: var(--accent-rose); text-align: center; padding: 2rem;">${this.esc(err.message)}</p>`;
      return;
    }
    const ev = st.evolution;
    const conectado = ev.estado === 'open';
    const situacao = !ev.configurada
      ? '<span class="wpp-pilula erro">Evolution API não configurada no servidor</span>'
      : conectado ? `<span class="wpp-pilula ok">Conectado · instância ${this.esc(ev.instancia)}</span>`
      : `<span class="wpp-pilula erro">Instância ${this.esc(ev.instancia)}: ${this.esc(ev.estado)}</span>`;
    const origem = { A: 'Diário', M: 'Manual', P: 'Pedido' };

    const linhas = st.cadastros.map(c => `
      <tr class="${c.ativo ? '' : 'wpp-inativo'}">
        <td><b>${c.codFornecedor}</b></td>
        <td>${this.esc(c.nome)}</td>
        <td style="white-space:nowrap;">${this.esc(this.fone(c.numero))}</td>
        <td>${c.ativo ? 'Ativo' : 'Pausado'}</td>
        <td class="wpp-acoes">
          <button class="acesso-acao liberar" onclick="Whatsapp.enviar(${c.id}, this)" ${ev.configurada ? '' : 'disabled'}>Enviar agora</button>
          <button class="acesso-acao" onclick="Whatsapp.alternar(${c.id})">${c.ativo ? 'Pausar' : 'Ativar'}</button>
          <button class="acesso-acao excluir" onclick="Whatsapp.excluir(${c.id})">Excluir</button>
        </td>
      </tr>`).join('');

    const envios = st.envios.map(e => `
      <tr>
        <td style="white-space:nowrap;">${this.esc(e.quando)}</td>
        <td>${this.esc(e.dataRef)}</td>
        <td>${e.codFornecedor} – ${this.esc(e.fornecedor)}</td>
        <td style="white-space:nowrap;">${this.esc(this.fone(e.destino))}</td>
        <td>${origem[e.origem] || this.esc(e.origem)}</td>
        <td class="${e.status === 'E' ? 'wpp-ok' : 'wpp-erro'}" title="${this.esc(e.erro)}">${e.status === 'E' ? 'Enviado' : 'Falhou'}</td>
      </tr>`).join('');

    el.innerHTML = `
      ${st.modoTeste ? `<div class="wpp-aviso">Modo de teste: todos os envios vão somente para <b>${this.esc(this.fone(st.destinoTeste))}</b>, e só esse número é atendido quando pede o relatório.</div>` : ''}
      ${aviso ? `<div class="wpp-aviso ok">${this.esc(aviso)}</div>` : ''}

      <div class="wpp-bloco">
        <div class="wpp-titulo">Conexão e envio diário ${situacao}</div>
        <form class="wpp-form" onsubmit="Whatsapp.salvarConfig(event)">
          <label class="wpp-check"><input type="checkbox" name="ativo" ${st.config.ativo ? 'checked' : ''}> Enviar o relatório todos os dias</label>
          <label>Horário <input type="time" name="hora" value="${this.esc(st.config.hora)}" required></label>
          <button class="acesso-acao liberar" type="submit">Salvar</button>
          ${ev.webhookConfiguravel ? '<button class="acesso-acao" type="button" onclick="Whatsapp.webhook(this)" title="Faz a Evolution API avisar o sistema quando um fretista manda mensagem">Ativar pedidos pelo WhatsApp</button>' : ''}
        </form>
        <p class="acesso-nota">O relatório do dia anterior é enviado em PDF, no horário acima (${this.esc(st.config.fuso)}), para os cadastros ativos que tiveram produção. O fretista também pode pedir o relatório enviando uma mensagem para o número da usina.</p>
      </div>

      <div class="wpp-bloco">
        <div class="wpp-titulo">Novo cadastro</div>
        <form class="wpp-form" onsubmit="Whatsapp.cadastrar(event)">
          <label>Código do fornecedor <input name="codFornecedor" list="wpp-fornecedores" inputmode="numeric" pattern="[0-9]{1,9}" placeholder="ex.: 37881" required autocomplete="off"></label>
          <datalist id="wpp-fornecedores"></datalist>
          <label>WhatsApp (com DDD) <input name="numero" type="tel" placeholder="(82) 99999-9999" required autocomplete="off"></label>
          <button class="acesso-acao liberar" type="submit">Cadastrar</button>
        </form>
        <p class="acesso-nota">O nome é buscado no cadastro de fornecedores da usina. Um fornecedor pode ter mais de um número, e um número pode receber de mais de um fornecedor.</p>
      </div>

      <div class="wpp-bloco">
        <div class="wpp-titulo">Cadastros (${st.cadastros.length})</div>
        ${linhas ? `<div class="wpp-tabela"><table><thead><tr><th>Cód.</th><th>Fornecedor</th><th>WhatsApp</th><th>Situação</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>`
                 : '<p class="acesso-nota">Nenhum número cadastrado ainda.</p>'}
      </div>

      <div class="wpp-bloco">
        <div class="wpp-titulo">Últimos envios</div>
        ${envios ? `<div class="wpp-tabela"><table><thead><tr><th>Quando</th><th>Produção de</th><th>Fornecedor</th><th>Enviado para</th><th>Origem</th><th>Resultado</th></tr></thead><tbody>${envios}</tbody></table></div>`
                 : '<p class="acesso-nota">Nenhum envio registrado.</p>'}
      </div>`;
    this.preencherFornecedores();
  },

  async executar(acao, aviso) {
    try {
      const r = await acao();
      await this.render(typeof aviso === 'function' ? aviso(r) : aviso);
    } catch (err) {
      alert(err.message);
    }
  },

  salvarConfig(e) {
    e.preventDefault();
    const f = e.target;
    this.executar(() => this.chamar('/config', { ativo: f.ativo.checked, hora: f.hora.value }), 'Configuração salva.');
  },

  cadastrar(e) {
    e.preventDefault();
    const f = e.target;
    this.executar(() => this.chamar('/cadastro', { codFornecedor: f.codFornecedor.value.trim(), numero: f.numero.value }),
      r => `Cadastrado: ${r.nome}.`);
  },

  alternar(id) {
    const c = this.estado.cadastros.find(x => x.id === id);
    if (!c) return;
    this.executar(() => this.chamar('/cadastro', { id, codFornecedor: c.codFornecedor, numero: c.numero, ativo: !c.ativo }));
  },

  excluir(id) {
    if (!confirm('Excluir este cadastro? O número deixa de receber e de poder pedir o relatório.')) return;
    this.executar(() => this.chamar('/excluir', { id }));
  },

  async enviar(id, botao) {
    botao.disabled = true;
    botao.textContent = 'Enviando…';
    await this.executar(() => this.chamar('/enviar', { id }), r => r.resultado === 'ENVIADO'
      ? `Relatório de ${r.dataRef} enviado para ${this.fone(r.destino)}${r.modoTeste ? ' (modo de teste)' : ''}.`
      : `Nada enviado: o fornecedor não tem produção registrada na safra até ${r.dataRef}.`);
  },

  async webhook(botao) {
    botao.disabled = true;
    await this.executar(() => this.chamar('/webhook', {}), 'Pedidos pelo WhatsApp ativados na Evolution API.');
  }
};
