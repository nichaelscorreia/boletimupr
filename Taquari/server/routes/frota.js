const express = require('express');
const router = express.Router();
const oracle = require('../db/oracle');
const queries = require('../db/queries');
const mock = require('../db/mockData');
const config = require('../config');

// GET /api/frota (Resumo de Transporte, Carregamento, Proprietário e Detalhe)
router.get('/', async (req, res) => {
  try {
    if (oracle.isOracleConnected()) {
      const [transpRows, carregRows, propRows, dathorRows] = await Promise.all([
        oracle.executeQuery(queries.frota.transportePorTipo(config.safra)),
        oracle.executeQuery(queries.frota.carregamentoPorTipo(config.safra)),
        oracle.executeQuery(queries.frota.transportePorProprietario(config.safra)),
        oracle.executeQuery(queries.agricola.dataHoraAtual)
      ]);

      const dathor = (dathorRows && dathorRows[0]) ? dathorRows[0].DATHOR : '19/09/2026 11:30';

      return res.json({
        dathor,
        transportePorTipo: (transpRows || []).map(r => ({
          tipo: r.TIPO,
          codTipoEquipamento: r.COD_TIPOEQUIPAMENTO,
          descricao: r.DESCRICAOTIPOEQUIPAMENTO ? r.DESCRICAOTIPOEQUIPAMENTO.trim() : '',
          hoje: parseFloat(r.HOJE || 0),
          ontem: parseFloat(r.ONTEM || 0),
          semana: parseFloat(r.SEMANA || 0),
          safra: parseFloat(r.SAFRA || 0),
          litros: parseFloat(r.LITROS || 0),
          media: r.MEDIA !== null ? parseFloat(r.MEDIA) : null
        })),
        carregamentoPorTipo: (carregRows || []).map(r => ({
          codTipoEquipamento: r.COD_TIPOEQUIPAMENTO,
          descricao: r.DESCRICAOTIPOEQUIPAMENTO ? r.DESCRICAOTIPOEQUIPAMENTO.trim() : '',
          hoje: parseFloat(r.HOJE || 0),
          ontem: parseFloat(r.ONTEM || 0),
          semana: parseFloat(r.SEMANA || 0),
          safra: parseFloat(r.SAFRA || 0),
          litros: parseFloat(r.LITROS || 0),
          media: r.MEDIA !== null ? parseFloat(r.MEDIA) : null
        })),
        transportePorProprietario: (propRows || []).map(r => ({
          codFornecedor: r.COD_FORNECEDOR,
          nome: r.NOME ? r.NOME.trim() : '',
          hoje: parseFloat(r.HOJE || 0),
          ontem: parseFloat(r.ONTEM || 0),
          semana: parseFloat(r.SEMANA || 0),
          safra: parseFloat(r.SAFRA || 0),
          litros: parseFloat(r.LITROS || 0),
          media: r.MEDIA !== null ? parseFloat(r.MEDIA) : null
        })),
        isLiveDb: true
      });
    }
  } catch (err) {
    console.error('Erro na rota frota:', err);
  }

  const data = mock.getMockFrotaData();
  res.json({ ...data, isLiveDb: false });
});

// GET /api/frota/detalhe?tipo=T&codigo=6
router.get('/detalhe', async (req, res) => {
  try {
    const { tipo = 'T', codigo } = req.query;
    if (oracle.isOracleConnected()) {
      const rows = await oracle.executeQuery(queries.frota.detalheEquipamentos(config.safra, tipo, codigo));
      return res.json({
        equipamentos: (rows || []).map(r => ({
          codTipoEquipamento: r.COD_TIPOEQUIPAMENTO,
          tipoDescricao: r.DESCRICAOTIPOEQUIPAMENTO ? r.DESCRICAOTIPOEQUIPAMENTO.trim() : '',
          codEquipamento: r.COD_EQUIPAMENTO,
          descricao: r.DESCRICAO ? r.DESCRICAO.trim() : '',
          hoje: parseFloat(r.HOJE || 0),
          ontem: parseFloat(r.ONTEM || 0),
          semana: parseFloat(r.SEMANA || 0),
          safra: parseFloat(r.SAFRA || 0)
        })),
        isLiveDb: true
      });
    }
  } catch (err) {
    console.error('Erro na rota frota detalhe:', err);
  }
  res.json({ equipamentos: [], isLiveDb: false });
});

// GET /api/frota/disponibilidade (Disposição da Frota)
router.get('/disponibilidade', async (req, res) => {
  try {
    if (oracle.isOracleConnected()) {
      const [dispRows, dathorRows] = await Promise.all([
        oracle.executeQuery(queries.frota.disponibilidadeCompleta(config.safra)),
        oracle.executeQuery(queries.agricola.dataHoraAtual)
      ]);

      const dathor = (dathorRows && dathorRows[0]) ? dathorRows[0].DATHOR : '19/09/2026 11:30';

      const equipamentos = (dispRows || []).map(r => {
        const os = r.ORDEMSERVICO && r.ORDEMSERVICO !== '0' ? r.ORDEMSERVICO : null;
        const dentroPatio = r.DENTROFABRICA > 0;
        let status = 'TRANSITO';
        if (os) {
          status = 'MANUTENCAO';
        } else if (dentroPatio) {
          status = 'DESCARGA';
        }

        return {
          codTipoEquipamento: r.COD_TIPOEQUIPAMENTO,
          descTipoEquipamento: r.DESCRICAOTIPOEQUIPAMENTO ? r.DESCRICAOTIPOEQUIPAMENTO.trim() : '',
          codEquipamento: r.COD_EQUIPAMENTO,
          descricao: r.DESCRICAO ? r.DESCRICAO.trim() : '',
          categoria: r.TIPOEQUIPAMENTO, // CAMINHAO, REBOQUE, COLHEDORA, CARREGADEIRA, TRATOR
          status, // DESCARGA, TRANSITO, MANUTENCAO
          dentroPatio,
          ordemServico: os,
          ordemServicoRevisao: r.ORDEMSERVICOREVISAO && r.ORDEMSERVICOREVISAO !== '0' ? r.ORDEMSERVICOREVISAO : null,
          oficinaDataHora: r.OFICINA || null
        };
      });

      const kpis = {
        emDescarga: equipamentos.filter(e => e.status === 'DESCARGA').length,
        emTransito: equipamentos.filter(e => e.status === 'TRANSITO').length,
        emManutencao: equipamentos.filter(e => e.status === 'MANUTENCAO').length,
        total: equipamentos.length
      };

      return res.json({
        dathor,
        kpis,
        caminhoes: equipamentos.filter(e => e.categoria === 'CAMINHAO'),
        reboques: equipamentos.filter(e => e.categoria === 'REBOQUE'),
        colhedoras: equipamentos.filter(e => e.categoria === 'COLHEDORA'),
        carregadeiras: equipamentos.filter(e => e.categoria === 'CARREGADEIRA' || e.categoria === 'TRATOR'),
        todos: equipamentos,
        isLiveDb: true
      });
    }
  } catch (err) {
    console.error('Erro na rota frota disponibilidade:', err);
  }

  const data = mock.getMockFrotaDisponibilidade();
  res.json({ ...data, isLiveDb: false });
});

module.exports = router;
