// Executa uma rota GET do próprio app (as mesmas que alimentam as telas) sem passar pela rede,
// para o assistente responder com exatamente os dados que o painel mostra.

function chamarRota(router, url, query = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: 'GET',
      url,
      originalUrl: url,
      path: url,
      query,
      params: {},
      headers: {},
      get: () => undefined
    };
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ status: this.statusCode, body });
      },
      send(body) {
        resolve({ status: this.statusCode, body });
      },
      setHeader() {},
      getHeader() {}
    };
    router(req, res, (err) => reject(err || new Error(`Rota interna não encontrada: ${url}`)));
  });
}

module.exports = { chamarRota };
