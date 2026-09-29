// Cliente de Comunicação com a API REST do Boletim Online

const API = {
  baseUrl: '/api',

  async getStatus() {
    try {
      const res = await fetch(`${this.baseUrl}/status`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar status:', err);
      return null;
    }
  },

  async getAgricola() {
    try {
      const res = await fetch(`${this.baseUrl}/agricola`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar dados agrícolas:', err);
      return null;
    }
  },

  async getAgricolaDetalhe(params = {}) {
    try {
      const queryStr = new URLSearchParams(params).toString();
      const res = await fetch(`${this.baseUrl}/agricola/detalhe?${queryStr}`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar detalhe agrícola:', err);
      return null;
    }
  },

  async getAgricolaPlanejamento(params = {}) {
    try {
      const queryStr = new URLSearchParams(params).toString();
      const res = await fetch(`${this.baseUrl}/agricola/planejamento?${queryStr}`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar planejamento de colheita:', err);
      return null;
    }
  },

  async getIndustria() {
    try {
      const res = await fetch(`${this.baseUrl}/industria`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar dados da indústria:', err);
      return null;
    }
  },

  async getIndustriaParadas(moenda = '') {
    try {
      const res = await fetch(`${this.baseUrl}/industria/paradas?moenda=${encodeURIComponent(moenda)}`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar paradas:', err);
      return null;
    }
  },

  async getProducao() {
    try {
      const res = await fetch(`${this.baseUrl}/producao`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar produção:', err);
      return null;
    }
  },

  async getProducaoSemanal() {
    try {
      const res = await fetch(`${this.baseUrl}/producao/semanal`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar produção semanal:', err);
      return null;
    }
  },

  async getFrota() {
    try {
      const res = await fetch(`${this.baseUrl}/frota`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar frota:', err);
      return null;
    }
  },

  async getFrotaDisponibilidade() {
    try {
      const res = await fetch(`${this.baseUrl}/frota/disponibilidade`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar disponibilidade de frota:', err);
      return null;
    }
  },

  async getFrotaDetalhe(tipo = 'T', codigo = '') {
    try {
      const res = await fetch(`${this.baseUrl}/frota/detalhe?tipo=${encodeURIComponent(tipo)}&codigo=${encodeURIComponent(codigo || '')}`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar detalhe da frota:', err);
      return null;
    }
  },

  async getLaboratorio() {
    try {
      const res = await fetch(`${this.baseUrl}/laboratorio`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar laboratório:', err);
      return null;
    }
  },

  async getMapas() {
    try {
      const res = await fetch(`${this.baseUrl}/mapas`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar mapas:', err);
      return null;
    }
  },

  async getSeguranca() {
    try {
      const res = await fetch(`${this.baseUrl}/seguranca`);
      return await res.json();
    } catch (err) {
      console.error('Erro ao buscar segurança:', err);
      return null;
    }
  }
};
