const express = require('express');
const path = require('path');
const config = require('./config');
const oracle = require('./db/oracle');

const agricolaRoutes = require('./routes/agricola');
const industriaRoutes = require('./routes/industria');
const producaoRoutes = require('./routes/producao');
const frotaRoutes = require('./routes/frota');
const laboratorioRoutes = require('./routes/laboratorio');
const outrosRoutes = require('./routes/outros');
const acessoRoutes = require('./routes/acesso');
const painelRoutes = require('./routes/painel');
const assistenteRoutes = require('./routes/assistente');
const { exigirDispositivoAprovado } = require('./services/acessoDispositivo');

const app = express();

// No Render o app fica atrás de um proxy HTTPS: necessário para req.secure (cookie Secure) e req.ip
app.set('trust proxy', 1);
app.use(express.json({ limit: '10kb' }));

// Servir frontend estático da pasta public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check e status da conexão Oracle (livre: usado pelo health check do Render)
app.get('/api/status', (req, res) => {
  res.json({
    app: 'Boletim Online de Moagem',
    version: '2.0.0',
    oracleConnected: oracle.isOracleConnected(),
    safra: config.safra,
    timestamp: new Date().toISOString()
  });
});

// Identificação/liberação de dispositivos (livre para quem ainda não foi liberado)
app.use('/api/acesso', acessoRoutes);

// Daqui para baixo, só dispositivos liberados
app.use('/api', exigirDispositivoAprovado);

// Rotas da API REST
app.use('/api/agricola', agricolaRoutes);
app.use('/api/industria', industriaRoutes);
app.use('/api/producao', producaoRoutes);
app.use('/api/frota', frotaRoutes);
app.use('/api/laboratorio', laboratorioRoutes);
app.use('/api/painel', painelRoutes);
app.use('/api/assistente', assistenteRoutes);
app.use('/api', outrosRoutes);

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function startServer() {
  // Tentar conectar ao Oracle em background
  oracle.initOraclePool().catch(err => {
    console.warn('Inicialização do Oracle falhou:', err.message);
  });

  app.listen(config.port, () => {
    console.log(`====================================================`);
    console.log(`🚀 Boletim Online de Moagem 2.0 Ativo!`);
    console.log(`📡 URL Local: http://localhost:${config.port}`);
    console.log(`🏢 Modo Gestão à Vista & TV Corporativa habilitado`);
    console.log(`====================================================`);
  });
}

startServer();
