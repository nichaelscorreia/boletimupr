const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const oracle = require('./db/oracle');

const agricolaRoutes = require('./routes/agricola');
const industriaRoutes = require('./routes/industria');
const producaoRoutes = require('./routes/producao');
const frotaRoutes = require('./routes/frota');
const laboratorioRoutes = require('./routes/laboratorio');
const outrosRoutes = require('./routes/outros');

const app = express();

app.use(cors());
app.use(express.json());

// Servir frontend estático da pasta public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotas da API REST
app.use('/api/agricola', agricolaRoutes);
app.use('/api/industria', industriaRoutes);
app.use('/api/producao', producaoRoutes);
app.use('/api/frota', frotaRoutes);
app.use('/api/laboratorio', laboratorioRoutes);
app.use('/api', outrosRoutes);

// Health check e status da conexão Oracle
app.get('/api/status', (req, res) => {
  res.json({
    app: 'Boletim Online de Moagem',
    version: '2.0.0',
    oracleConnected: oracle.isOracleConnected(),
    safra: config.safra,
    timestamp: new Date().toISOString()
  });
});

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
