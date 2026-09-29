const express = require('express');
const router = express.Router();
const mock = require('../db/mockData');

// GET /api/laboratorio
router.get('/laboratorio', (req, res) => {
  res.json(mock.getMockLaboratorioData());
});

// GET /api/mapas
router.get('/mapas', (req, res) => {
  res.json(mock.getMockMapasData());
});

// GET /api/seguranca
router.get('/seguranca', (req, res) => {
  res.json(mock.getMockSegurancaData());
});

module.exports = router;
