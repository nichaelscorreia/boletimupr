// Assistente de dados: perguntas por texto ou voz sobre os dados do painel

const Assistente = {
  conversaId: null,
  aguardando: false,
  configurado: false,   // há chave da API no servidor
  habilitado: false,    // ligado pelo administrador
  podeAlterar: false,   // este dispositivo é administrador
  falarRespostas: false,
  reconhecimento: null,
  ouvindo: false,

  SUGESTOES: [
    'Qual fazenda teve o melhor ATR ontem?',
    'Quanto de cana entrou hoje e quanto na safra?',
    'Como está o cumprimento do planejamento da cana própria?',
    'Quais foram as principais causas de parada na safra?'
  ],

  async iniciar() {
    try {
      const r = await fetch('/api/assistente/status');
      if (!r.ok) return;
      const st = await r.json();
      this.configurado = !!st.configurado;
      this.habilitado = !!st.habilitado;
      this.podeAlterar = !!st.podeAlterar;
    } catch (e) {
      return;
    }
    try { this.falarRespostas = localStorage.getItem('assistenteVoz') === '1'; } catch (e) { /* sem storage */ }
    if (this.configurado && this.habilitado) this.montar();
  },

  // Mostra/esconde o botão conforme o assistente está ligado ou desligado
  aplicarEstado() {
    if (this.habilitado) {
      this.montar();
      document.getElementById('assist-botao').classList.remove('desativado');
      document.getElementById('assist-painel').classList.remove('desativado');
    } else if (document.getElementById('assist-botao')) {
      this.fechar();
      document.getElementById('assist-botao').classList.add('desativado');
      document.getElementById('assist-painel').classList.add('desativado');
    }
  },

  // Bloco exibido no painel de administração (Dispositivos com acesso)
  controleAdmin() {
    if (!this.configurado || !this.podeAlterar) return '';
    return `
      <div class="assist-admin ${this.habilitado ? 'ligado' : 'desligado'}">
        <div>
          <b>Assistente de dados (perguntas por texto e voz)</b>
          <small>${this.habilitado
            ? 'Ligado: o botão "Pergunte" aparece para todos os dispositivos liberados. Cada pergunta tem custo.'
            : 'Desligado: ninguém consegue fazer perguntas e não há custo.'}</small>
        </div>
        <button type="button" class="acesso-acao ${this.habilitado ? 'bloquear' : 'liberar'}"
                onclick="Assistente.definirHabilitado(${!this.habilitado})">${this.habilitado ? 'Desligar' : 'Ligar'}</button>
      </div>`;
  },

  async definirHabilitado(valor) {
    try {
      const res = await fetch('/api/assistente/habilitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habilitado: valor })
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || 'Não foi possível alterar.');
      this.habilitado = valor;
      this.aplicarEstado();
    } catch (err) {
      alert(err.message);
    }
    if (typeof Acesso !== 'undefined') Acesso.renderAdmin();
  },

  isOpen() {
    return document.getElementById('assist-painel')?.classList.contains('aberto') || false;
  },

  esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  montar() {
    if (document.getElementById('assist-botao')) return; // já montado
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const temVoz = !!SR;
    const temFala = 'speechSynthesis' in window;

    document.body.insertAdjacentHTML('beforeend', `
      <button type="button" id="assist-botao" class="assist-botao" title="Perguntar sobre os dados" aria-label="Abrir assistente de dados"
              onclick="Assistente.abrir()">
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
        <span>Pergunte</span>
      </button>
      <div id="assist-painel" class="assist-painel" role="dialog" aria-label="Assistente de dados">
        <div class="assist-topo">
          <div>
            <b>Assistente de dados</b>
            <small>Respostas com base nos dados do painel</small>
          </div>
          <div class="assist-topo-acoes">
            ${temFala ? `<button type="button" id="assist-voz-saida" class="assist-icone" title="Ler respostas em voz alta" onclick="Assistente.alternarFala()">🔈</button>` : ''}
            <button type="button" class="assist-icone" title="Nova conversa" onclick="Assistente.nova()">↺</button>
            <button type="button" class="assist-icone" title="Fechar" onclick="Assistente.fechar()">✕</button>
          </div>
        </div>
        <div id="assist-mensagens" class="assist-mensagens"></div>
        <form id="assist-form" class="assist-form" autocomplete="off">
          ${temVoz ? `<button type="button" id="assist-mic" class="assist-mic" title="Perguntar por voz" onclick="Assistente.alternarMic()">🎤</button>` : ''}
          <textarea id="assist-entrada" rows="1" maxlength="1000" placeholder="${temVoz ? 'Digite ou toque no microfone…' : 'Digite sua pergunta…'}"></textarea>
          <button type="submit" id="assist-enviar" class="assist-enviar" title="Enviar">➤</button>
        </form>
      </div>
    `);

    const entrada = document.getElementById('assist-entrada');
    document.getElementById('assist-form').addEventListener('submit', (e) => { e.preventDefault(); this.enviar(); });
    entrada.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.enviar(); }
    });
    entrada.addEventListener('input', () => { entrada.style.height = 'auto'; entrada.style.height = Math.min(entrada.scrollHeight, 120) + 'px'; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen()) this.fechar(); });

    if (temVoz) this.prepararVoz(SR);
    this.atualizarBotaoFala();
    this.boasVindas();
  },

  boasVindas() {
    const el = document.getElementById('assist-mensagens');
    el.innerHTML = `
      <div class="assist-msg assist-bot">
        Olá! Pergunte o que quiser sobre os dados do painel: entrada e qualidade da cana, fazendas, planejamento, indústria, produção, frota ou laboratório.
        <div class="assist-sugestoes">
          ${this.SUGESTOES.map(s => `<button type="button" onclick="Assistente.usarSugestao(this)">${this.esc(s)}</button>`).join('')}
        </div>
      </div>`;
  },

  abrir() {
    document.getElementById('assist-painel').classList.add('aberto');
    document.getElementById('assist-botao').classList.add('oculto');
    setTimeout(() => document.getElementById('assist-entrada')?.focus(), 50);
  },

  fechar() {
    this.pararMic();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    document.getElementById('assist-painel').classList.remove('aberto');
    document.getElementById('assist-botao').classList.remove('oculto');
  },

  usarSugestao(btn) {
    document.getElementById('assist-entrada').value = btn.textContent;
    this.enviar();
  },

  async nova() {
    if (this.aguardando) return;
    if (this.conversaId) {
      fetch('/api/assistente/nova', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversaId: this.conversaId }) }).catch(() => {});
    }
    this.conversaId = null;
    this.boasVindas();
  },

  adicionar(classe, html) {
    const el = document.getElementById('assist-mensagens');
    el.insertAdjacentHTML('beforeend', `<div class="assist-msg ${classe}">${html}</div>`);
    el.scrollTop = el.scrollHeight;
    return el.lastElementChild;
  },

  async enviar() {
    const entrada = document.getElementById('assist-entrada');
    const pergunta = entrada.value.trim();
    if (!pergunta || this.aguardando) return;
    this.pararMic();
    entrada.value = '';
    entrada.style.height = 'auto';
    this.adicionar('assist-usuario', this.esc(pergunta));
    const pensando = this.adicionar('assist-bot assist-pensando', '<span class="assist-pontos"><i></i><i></i><i></i></span> Consultando os dados…');
    this.aguardando = true;
    document.getElementById('assist-enviar').disabled = true;

    try {
      const res = await fetch('/api/assistente/perguntar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta, conversaId: this.conversaId })
      });
      const r = await res.json().catch(() => ({}));
      pensando.remove();
      if (!res.ok) {
        this.adicionar('assist-bot assist-erro', this.esc(r.error || r.acesso || 'Não foi possível responder agora.'));
        if (r.desativado) { // o administrador desligou enquanto este painel estava aberto
          this.habilitado = false;
          setTimeout(() => this.aplicarEstado(), 2500);
        }
        return;
      }
      this.conversaId = r.conversaId;
      const fontes = r.consultas && r.consultas.length
        ? `<div class="assist-fontes">Fonte: ${r.consultas.map(c => this.esc(c)).join(' · ')}</div>` : '';
      this.adicionar('assist-bot', this.markdown(r.resposta) + fontes);
      if (this.falarRespostas) this.falar(r.resposta);
    } catch (err) {
      pensando.remove();
      this.adicionar('assist-bot assist-erro', 'Falha de conexão. Tente novamente.');
    } finally {
      this.aguardando = false;
      document.getElementById('assist-enviar').disabled = false;
    }
  },

  // Markdown simples e seguro (texto escapado antes): parágrafos, listas, negrito/itálico, tabelas
  markdown(texto) {
    const inline = (t) => this.esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])_(.+?)_(?=[\s.,;:)!?]|$)/g, '$1<i>$2</i>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
    const linhas = String(texto || '').split('\n');
    const out = [];
    let i = 0;
    while (i < linhas.length) {
      const l = linhas[i];
      if (/^\s*\|.*\|\s*$/.test(l)) {
        const tabela = [];
        while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) tabela.push(linhas[i++]);
        const celulas = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const corpo = tabela.filter(r => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
        const [cab, ...resto] = corpo;
        out.push(`<div class="assist-tabela"><table><thead><tr>${celulas(cab).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${
          resto.map(r => `<tr>${celulas(r).map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      if (/^\s*[-*•]\s+/.test(l)) {
        const itens = [];
        while (i < linhas.length && /^\s*[-*•]\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*[-*•]\s+/, ''));
        out.push(`<ul>${itens.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`);
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(l)) {
        const itens = [];
        while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*\d+[.)]\s+/, ''));
        out.push(`<ol>${itens.map(t => `<li>${inline(t)}</li>`).join('')}</ol>`);
        continue;
      }
      if (/^\s*#{1,4}\s+/.test(l)) { out.push(`<p><b>${inline(l.replace(/^\s*#{1,4}\s+/, ''))}</b></p>`); i++; continue; }
      if (l.trim()) out.push(`<p>${inline(l)}</p>`);
      i++;
    }
    return out.join('');
  },

  // ---- Voz: entrada (reconhecimento) e saída (leitura) ----

  prepararVoz(SR) {
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let texto = '';
      for (const r of e.results) texto += r[0].transcript;
      document.getElementById('assist-entrada').value = texto;
      if (e.results[e.results.length - 1].isFinal) {
        this.pararMic();
        this.enviar();
      }
    };
    rec.onerror = (e) => {
      this.pararMic();
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.adicionar('assist-bot assist-erro', 'Permita o uso do microfone no navegador para perguntar por voz.');
      }
    };
    rec.onend = () => this.pararMic();
    this.reconhecimento = rec;
  },

  alternarMic() {
    if (this.ouvindo) { this.reconhecimento.stop(); this.pararMic(); return; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    try {
      this.reconhecimento.start();
      this.ouvindo = true;
      document.getElementById('assist-mic').classList.add('ouvindo');
      document.getElementById('assist-entrada').placeholder = 'Ouvindo… fale sua pergunta';
    } catch (e) { /* já estava ouvindo */ }
  },

  pararMic() {
    this.ouvindo = false;
    const mic = document.getElementById('assist-mic');
    if (mic) mic.classList.remove('ouvindo');
    const entrada = document.getElementById('assist-entrada');
    if (entrada) entrada.placeholder = this.reconhecimento ? 'Digite ou toque no microfone…' : 'Digite sua pergunta…';
  },

  alternarFala() {
    this.falarRespostas = !this.falarRespostas;
    if (!this.falarRespostas) speechSynthesis.cancel();
    try { localStorage.setItem('assistenteVoz', this.falarRespostas ? '1' : '0'); } catch (e) { /* sem storage */ }
    this.atualizarBotaoFala();
  },

  atualizarBotaoFala() {
    const b = document.getElementById('assist-voz-saida');
    if (!b) return;
    b.textContent = this.falarRespostas ? '🔊' : '🔈';
    b.title = this.falarRespostas ? 'Leitura em voz alta: ligada' : 'Ler respostas em voz alta';
    b.classList.toggle('ativo', this.falarRespostas);
  },

  // Lê a resposta sem tabelas e sem marcações (tabelas não soam bem em voz)
  falar(texto) {
    const limpo = String(texto || '').split('\n')
      .filter(l => !/^\s*\|/.test(l))
      .join('. ')
      .replace(/[*_`#>]/g, '')
      .replace(/\s+\.\s+/g, '. ');
    const fala = new SpeechSynthesisUtterance(limpo);
    fala.lang = 'pt-BR';
    const voz = speechSynthesis.getVoices().find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR');
    if (voz) fala.voice = voz;
    speechSynthesis.cancel();
    speechSynthesis.speak(fala);
  }
};
