// Mock Data Engine de Alta Fidelidade para Operações Sucroalcooleiras em Tempo Real

function getMockAgricolaData() {
  const now = new Date();
  const dathor = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Estimativa de Safra
  const estimativaSafra = {
    toneladasPrevistasTotal: 2650000.0,
    saldoAColher: 842150.45,
    colhidoAcimaPrevisto: 18420.3,
    previsaoTermino: '28/11/2026 18:30',
    diasRestantes: 68.4,
    mediaHora: 512.8,
    areaEstimada: 32450.0,
    tchPrevisto: 81.66,
    tchRealizado: 83.42,
    atrMedio: 139.45,
    brixMedio: 21.8,
    polMedio: 15.2,
    purezaMedia: 86.4
  };

  // Resumo Entrada Colhedora (Mecanizada)
  const resumoColhedora = [
    { tipo: '0', tipo2: '1', periodo: 'Hoje (06h às 05h)', datini: 'Hoje', datfin: 'Hoje', horini: 6, horfin: 5, pesliq: 11480.65, viagens: 398, media_viagem: 28.85, partic: 93.8 },
    { tipo: '0', tipo2: '2', periodo: 'Ontem', datini: 'Ontem', datfin: 'Ontem', horini: 6, horfin: 5, pesliq: 12240.12, viagens: 422, media_viagem: 29.00, partic: 94.2 },
    { tipo: '0', tipo2: '3', periodo: 'Mês Atual', datini: '01/09/2026', datfin: '30/09/2026', horini: 0, horfin: 23, pesliq: 228450.80, viagens: 7890, media_viagem: 28.95, partic: 93.9 },
    { tipo: '0', tipo2: '4', periodo: 'Safra 2026/27', datini: '01/04/2026', datfin: 'Hoje', horini: 0, horfin: 23, pesliq: 1705620.15, viagens: 58920, media_viagem: 28.95, partic: 93.5 }
  ];

  // Resumo Entrada Manual
  const resumoManual = [
    { tipo: '1', tipo2: '1', periodo: 'Hoje (06h às 05h)', datini: 'Hoje', datfin: 'Hoje', horini: 6, horfin: 5, pesliq: 760.20, viagens: 32, media_viagem: 23.76, partic: 6.2 },
    { tipo: '1', tipo2: '2', periodo: 'Ontem', datini: 'Ontem', datfin: 'Ontem', horini: 6, horfin: 5, pesliq: 755.40, viagens: 31, media_viagem: 24.37, partic: 5.8 },
    { tipo: '1', tipo2: '3', periodo: 'Mês Atual', datini: '01/09/2026', datfin: '30/09/2026', horini: 0, horfin: 23, pesliq: 14820.30, viagens: 620, media_viagem: 23.90, partic: 6.1 },
    { tipo: '1', tipo2: '4', periodo: 'Safra 2026/27', datini: '01/04/2026', datfin: 'Hoje', horini: 0, horfin: 23, pesliq: 118420.00, viagens: 4950, media_viagem: 23.92, partic: 6.5 }
  ];

  // Entrada de cana por hora (06h a 05h)
  const horasCiclo = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
    '00:00', '01:00', '02:00', '03:00', '04:00', '05:00'
  ];

  const currentHour = now.getHours();
  const entradaPorHora = horasCiclo.map((h, index) => {
    const hourVal = parseInt(h.split(':')[0], 10);
    const isPast = (hourVal <= currentHour && hourVal >= 6) || (currentHour < 6 && (hourVal >= 6 || hourVal <= currentHour));
    const isCurrent = hourVal === currentHour;
    
    // Gerar valores realistas com pequenas variações por hora
    const baseTon = isPast ? Math.floor(480 + Math.sin(index) * 60 + (index % 3) * 25) : 0;
    const viagens = baseTon > 0 ? Math.round(baseTon / 28.5) : 0;
    
    return {
      hora: h,
      horaNum: hourVal,
      toneladas: isCurrent ? Math.round(baseTon * 0.65) : baseTon,
      viagens: isCurrent ? Math.round(viagens * 0.65) : viagens,
      status: isCurrent ? 'em_andamento' : (isPast ? 'concluido' : 'futuro'),
      mediaViagem: viagens > 0 ? Number((baseTon / viagens).toFixed(2)) : 0,
      atr: isPast ? Number((138.5 + (Math.sin(index * 2) * 2.5)).toFixed(2)) : null
    };
  });

  return {
    dathor,
    safra: '2026/2027',
    estimativaSafra,
    resumoColhedora,
    resumoManual,
    entradaPorHora
  };
}

function getMockAgricolaDetalhe(params = {}) {
  const { tipo = '0', datini = 'Hoje', datfin = 'Hoje', tipcol = 'M' } = params;

  const fornecedores = [
    { fornecedor: 'USINA PROPRIA (FAZENDAS)', fazenda: 'FAZENDA SANTA HELENA', tipocorte: 'MECANIZADA CRUA', viagens: 112, pesliq: 3248.50, partic: 28.3, mediaviagem: 29.00, brix: 22.1, pol: 15.4, pureza: 86.8, tch: 84.5 },
    { fornecedor: 'USINA PROPRIA (FAZENDAS)', fazenda: 'FAZENDA BOA VISTA', tipocorte: 'MECANIZADA CRUA', viagens: 94, pesliq: 2716.60, partic: 23.7, mediaviagem: 28.90, brix: 21.8, pol: 15.1, pureza: 86.2, tch: 82.1 },
    { fornecedor: 'USINA PROPRIA (FAZENDAS)', fazenda: 'FAZENDA SAO PEDRO', tipocorte: 'MECANIZADA CRUA', viagens: 76, pesliq: 2196.40, partic: 19.1, mediaviagem: 28.90, brix: 21.5, pol: 14.9, pureza: 85.9, tch: 81.3 },
    { fornecedor: 'AGROPECUARIA VALE VERDE LTDA', fazenda: 'FAZENDA PLANALTO', tipocorte: 'MECANIZADA CRUA', viagens: 45, pesliq: 1305.00, partic: 11.4, mediaviagem: 29.00, brix: 22.4, pol: 15.6, pureza: 87.1, tch: 86.2 },
    { fornecedor: 'COND. RURAL IRMAOS SILVA', fazenda: 'SITIO DAS PALMEIRAS', tipocorte: 'MECANIZADA CRUA', viagens: 38, pesliq: 1098.20, partic: 9.6, mediaviagem: 28.90, brix: 21.9, pol: 15.2, pureza: 86.4, tch: 79.8 },
    { fornecedor: 'JOSE CARLOS MENDONCA', fazenda: 'FAZENDA PRIMAVERA', tipocorte: 'MECANIZADA CRUA', viagens: 33, pesliq: 915.95, partic: 7.9, mediaviagem: 27.75, brix: 21.2, pol: 14.6, pureza: 85.1, tch: 77.4 }
  ];

  const variedades = [
    { variedade: 'RB966928', viagens: 152, pesliq: 4408.00, partic: 38.4, mediaviagem: 29.00, brix: 22.3, pol: 15.5, pureza: 86.9, atr: 142.1 },
    { variedade: 'CTC4', viagens: 98, pesliq: 2842.00, partic: 24.7, mediaviagem: 29.00, brix: 21.8, pol: 15.1, pureza: 86.3, atr: 138.6 },
    { variedade: 'RB867515', viagens: 74, pesliq: 2146.00, partic: 18.7, mediaviagem: 29.00, brix: 21.4, pol: 14.8, pureza: 85.8, atr: 135.2 },
    { variedade: 'CTC9001', viagens: 46, pesliq: 1334.00, partic: 11.6, mediaviagem: 29.00, brix: 22.0, pol: 15.3, pureza: 86.5, atr: 140.4 },
    { variedade: 'IACSP95-5000', viagens: 28, pesliq: 750.65, partic: 6.6, mediaviagem: 26.80, brix: 21.1, pol: 14.5, pureza: 85.0, atr: 132.8 }
  ];

  return {
    titulo: `Detalhamento da Entrada de Cana (${datini} a ${datfin})`,
    tipo,
    tipcol,
    totalViagens: 398,
    totalToneladas: 11480.65,
    fornecedores,
    variedades
  };
}

function getMockIndustriaData() {
  const now = new Date();
  const dathor = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return {
    dathor,
    moendas: [
      {
        id: 'moenda_a',
        nome: 'Moenda A',
        status: 'RODANDO',
        statusColor: 'emerald',
        motivo: 'Sem ocorrências registradas',
        dataHora: '',
        horaIni: '',
        horaFim: '',
        tempo: ''
      },
      {
        id: 'moenda_b',
        nome: 'Moenda B',
        status: 'PARADA',
        statusColor: 'rose',
        motivo: 'Motivo: Manutenção Corretiva na Esteira',
        dataHora: 'Parada em 20/09/2026',
        horaIni: 'às 14:00Hrs',
        horaFim: '16:30',
        tempo: 'Tempo total parada: 02:30'
      }
    ],
    paradas: [
      {
        codObjeto: 3,
        datmov: '19/09/2026',
        horaIni: '08:00',
        horaFim: '08:45',
        tempoParada: '00:45',
        causa: 'Limpeza de Bica',
        objeto: 'Moenda',
        observacao: 'Limpeza de rotina'
      },
      {
        codObjeto: 355,
        datmov: '20/09/2026',
        horaIni: '14:00',
        horaFim: '16:30',
        tempoParada: '02:30',
        causa: 'Manutenção Corretiva',
        objeto: 'Moenda B',
        observacao: 'Troca de esteira'
      }
    ]
  };
}

function getMockProducaoData() {
  const now = new Date();
  const dathor = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return {
    dathor,
    resumoGeral: {
      moagemHoje: 12240.85,
      acucarTotalSacosHoje: 22650,
      acucarTotalTonHoje: 1132.5,
      etanolTotalM3Hoje: 825.4,
      mixProducao: { acucar: 56.4, etanol: 43.6 }
    },
    acucar: [
      { tipo: 'Açúcar VHP (Exportação)', producaoHojeSacos: 18450, producaoHojeTon: 922.5, estoqueSacos: 485200, saidaHojeSacos: 14000, caminhoesHoje: 28 },
      { tipo: 'Açúcar Cristal Branco', producaoHojeSacos: 4200, producaoHojeTon: 210.0, estoqueSacos: 124800, saidaHojeSacos: 3500, caminhoesHoje: 7 }
    ],
    etanol: [
      { tipo: 'Etanol Anidro Combustível', producaoHojeM3: 345.2, producaoHojeLitros: 345200, estoqueM3: 14850.0, saidaHojeM3: 280.0, caminhoesHoje: 6 },
      { tipo: 'Etanol Hidratado Carburante', producaoHojeM3: 480.2, producaoHojeLitros: 480200, estoqueM3: 22400.0, saidaHojeM3: 410.0, caminhoesHoje: 9 }
    ],
    expedicao: {
      totalCaminhoesHoje: 50,
      volumeAçucarSacos: 17500,
      volumeEtanolM3: 690.0,
      statusBalanca: 'Fluindo normalmente',
      tempoMedioCarregamento: '42 min'
    },
    producaoHoraria: Array.from({ length: 24 }, (_, i) => ({
      hora: `${String(i).padStart(2, '0')}:00`,
      acucarSacos: Math.floor(900 + Math.sin(i) * 120),
      etanolM3: Number((32 + Math.cos(i) * 5).toFixed(1)),
      caminhoes: (i >= 6 && i <= 20) ? Math.floor(2 + (i % 4)) : Math.floor(1 + (i % 2))
    }))
  };
}

function getMockProducaoSemanalData() {
  const semanas = [
    { sem: 18, periodo: '01/08 a 07/08', canaEntrada: 86450.0, acucarTon: 8120.0, etanolM3: 5820.0, atrMedio: 138.2, rtc: 92.4 },
    { sem: 19, periodo: '08/08 a 14/08', canaEntrada: 88200.0, acucarTon: 8350.0, etanolM3: 5940.0, atrMedio: 139.1, rtc: 93.1 },
    { sem: 20, periodo: '15/08 a 21/08', canaEntrada: 84900.0, acucarTon: 7980.0, etanolM3: 5710.0, atrMedio: 137.9, rtc: 91.8 },
    { sem: 21, periodo: '22/08 a 28/08', canaEntrada: 89100.0, acucarTon: 8490.0, etanolM3: 6020.0, atrMedio: 140.2, rtc: 93.8 },
    { sem: 22, periodo: '29/08 a 04/09', canaEntrada: 87600.0, acucarTon: 8240.0, etanolM3: 5890.0, atrMedio: 139.6, rtc: 92.9 },
    { sem: 23, periodo: '05/09 a 11/09', canaEntrada: 90250.0, acucarTon: 8610.0, etanolM3: 6150.0, atrMedio: 141.0, rtc: 94.2 },
    { sem: 24, periodo: '12/09 a 18/09 (Atual)', canaEntrada: 82400.0, acucarTon: 7850.0, etanolM3: 5620.0, atrMedio: 140.5, rtc: 93.5 }
  ];

  return {
    titulo: 'Acompanhamento Semanal da Safra',
    totalSafraCana: 1824040.15,
    totalSafraAcucarTon: 172450.0,
    totalSafraEtanolM3: 122850.0,
    semanas
  };
}

function getMockFrotaData() {
  const now = new Date();
  const dathor = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return {
    dathor,
    resumoFrota: [
      { tipoId: 1, tipo: 'COLHEDORAS DE CANA', total: 24, emOperacao: 21, emManutencao: 2, reserva: 1, dispMecanica: 91.7, rendimentoTonDia: 11480.65, consumoLitrosTon: 0.88 },
      { tipoId: 2, tipo: 'TRATORES DE TRANSBORDO', total: 48, emOperacao: 43, emManutencao: 4, reserva: 1, dispMecanica: 91.6, rendimentoTonDia: 11480.65, consumoLitrosTon: 0.54 },
      { tipoId: 3, tipo: 'CAMINHOES TREMINHAO (RODOVIARIO)', total: 42, emOperacao: 38, emManutencao: 3, reserva: 1, dispMecanica: 92.8, rendimentoTonDia: 9850.40, consumoLitrosTon: 1.12 },
      { tipoId: 4, tipo: 'CAMINHOES ROMEU E JULIETA', total: 16, emOperacao: 14, emManutencao: 2, reserva: 0, dispMecanica: 87.5, rendimentoTonDia: 2390.45, consumoLitrosTon: 1.25 },
      { tipoId: 5, tipo: 'PA-CARREGADEIRAS / HILO', total: 6, emOperacao: 6, emManutencao: 0, reserva: 0, dispMecanica: 100.0, rendimentoTonDia: 12240.85, consumoLitrosTon: 0.18 }
    ],
    equipamentosDestaque: [
      { frota: 'COL-108', modelo: 'John Deere CH570', frente: 'Frente 01 - Faz. Sta Helena', operador: 'Ailton M.', viagensHoje: 24, tonHoje: 698.4, status: 'Operando', combustivel: '78%' },
      { frota: 'COL-112', modelo: 'Case IH A8800', frente: 'Frente 02 - Faz. Boa Vista', operador: 'Marcos R.', viagensHoje: 22, tonHoje: 642.0, status: 'Operando', combustivel: '65%' },
      { frota: 'CAM-304', modelo: 'Volvo FMX 540', frente: 'Rota 1 - Usina x Sta Helena', motorista: 'Valdir S.', viagensHoje: 8, tonHoje: 232.0, status: 'Em Trânsito', combustivel: '82%' },
      { frota: 'CAM-318', modelo: 'Scania G500 XT', frente: 'Pátio de Descarga Hilo 2', motorista: 'Reginaldo P.', viagensHoje: 7, tonHoje: 204.5, status: 'Descarregando', combustivel: '54%' },
      { frota: 'COL-104', modelo: 'John Deere CH570', frente: 'Oficina Central', operador: '--', viagensHoje: 0, tonHoje: 0, status: 'Em Manutenção (OS 4512)', combustivel: '40%' }
    ]
  };
}

function getMockFrotaDisponibilidade() {
  const now = new Date();
  const dathor = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const frotasStatus = [
    { codEquipamento: 15010, descricao: 'JONH DEERE CH 5', categoria: 'COLHEDORA', status: 'TRANSITO', ordemServico: null },
    { codEquipamento: 15011, descricao: 'JONH DEERE CH 5', categoria: 'COLHEDORA', status: 'TRANSITO', ordemServico: null },
    { codEquipamento: 15012, descricao: 'JONH DEERE CH 5', categoria: 'COLHEDORA', status: 'TRANSITO', ordemServico: null },
    { codEquipamento: 15013, descricao: 'CASE IH 9900', categoria: 'COLHEDORA', status: 'MANUTENCAO', ordemServico: '4512', oficinaDataHora: '21/09/2026 14:30' },
    
    { codEquipamento: 12528, descricao: 'VOLVO FMX 500', categoria: 'CAMINHAO', status: 'MANUTENCAO', ordemServico: '46104', oficinaDataHora: '21/09/2026 16:57' },
    { codEquipamento: 12537, descricao: 'VOLVO FMX 500', categoria: 'CAMINHAO', status: 'DESCARGA', ordemServico: null },
    { codEquipamento: 12555, descricao: 'MERCEDES AROCS', categoria: 'CAMINHAO', status: 'MANUTENCAO', ordemServico: '45774', oficinaDataHora: '20/09/2026 03:42' },
    { codEquipamento: 12539, descricao: 'VOLVO FMX 540', categoria: 'CAMINHAO', status: 'TRANSITO', ordemServico: null },
    { codEquipamento: 12540, descricao: 'VOLVO FMX 540', categoria: 'CAMINHAO', status: 'DESCARGA', ordemServico: null },
    
    { codEquipamento: 16033, descricao: 'REBOQUE', categoria: 'REBOQUE', status: 'MANUTENCAO', ordemServico: '39998', oficinaDataHora: '10/07/2026 16:23' },
    { codEquipamento: 16090, descricao: 'REBOQUE', categoria: 'REBOQUE', status: 'MANUTENCAO', ordemServico: '46112', oficinaDataHora: '21/09/2026 18:00' },
    { codEquipamento: 16106, descricao: 'SEMI-REBOQUE', categoria: 'REBOQUE', status: 'MANUTENCAO', ordemServico: '46062', oficinaDataHora: '21/09/2026 13:45' },
    { codEquipamento: 16117, descricao: 'SEMI-REBOQUE', categoria: 'REBOQUE', status: 'TRANSITO', ordemServico: null },
    { codEquipamento: 16158, descricao: 'REBOQUE', categoria: 'REBOQUE', status: 'TRANSITO', ordemServico: null },
    
    { codEquipamento: 14019, descricao: 'VALTRA BM115', categoria: 'CARREGADEIRA', status: 'MANUTENCAO', ordemServico: '46120', oficinaDataHora: '21/09/2026 18:36' },
    { codEquipamento: 14014, descricao: 'VALTRA BM100', categoria: 'CARREGADEIRA', status: 'MANUTENCAO', ordemServico: '42252', oficinaDataHora: '20/08/2026 15:24' },
    { codEquipamento: 14005, descricao: 'VALTRA BM100', categoria: 'CARREGADEIRA', status: 'TRANSITO', ordemServico: null }
  ];

  return {
    dathor,
    kpis: {
      emDescarga: 2,
      emTransito: 7,
      emManutencao: 8,
      total: 17
    },
    caminhoes: frotasStatus.filter(e => e.categoria === 'CAMINHAO'),
    reboques: frotasStatus.filter(e => e.categoria === 'REBOQUE'),
    colhedoras: frotasStatus.filter(e => e.categoria === 'COLHEDORA'),
    carregadeiras: frotasStatus.filter(e => e.categoria === 'CARREGADEIRA' || e.categoria === 'TRATOR'),
    todos: frotasStatus
  };
}

function getMockLaboratorioData() {
  const now = new Date();
  const dathor = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return {
    dathor,
    qualidadeCana: {
      brix: 21.85,
      pol: 15.24,
      pureza: 86.42,
      fibra: 12.80,
      ar: 0.65,
      atr: 139.80,
      pbu: 88.50
    },
    caldoPrimario: {
      brix: 22.40,
      pol: 19.45,
      pureza: 86.83,
      ph: 5.4
    },
    caldoMisto: {
      brix: 16.20,
      pol: 13.98,
      pureza: 86.30,
      ph: 5.2
    },
    bagaco: {
      umidade: 49.80,
      pol: 1.62
    },
    tortaFiltro: {
      umidade: 74.20,
      pol: 1.45
    },
    historicoHorario: Array.from({ length: 12 }, (_, i) => ({
      hora: `${String(i * 2).padStart(2, '0')}:00`,
      atr: Number((138.0 + Math.sin(i) * 2.2).toFixed(2)),
      brix: Number((21.5 + Math.sin(i) * 0.5).toFixed(2)),
      pureza: Number((86.0 + Math.cos(i) * 0.8).toFixed(2))
    }))
  };
}

function getMockSegurancaData() {
  return {
    diasSemAcidentesComAfastamento: 418,
    recordeHistorico: 520,
    diasSemAcidentesSemAfastamento: 94,
    metaCorporativa: 'Zero Acidente Sempre',
    totalColaboradoresAtivos: 1845,
    treinamentosSegurancaMes: 48,
    quaseAcidentesRelatadosTratados: '100%',
    statusCipa: 'Comitê CIPA Ativo - Gestão 2026/2027'
  };
}

function getMockMapasData() {
  return {
    colheita: {
      frentes: [
        { id: 1, nome: 'Frente 01 - Cana Crua Alta Produtividade', fazenda: 'Faz. Santa Helena', talhoes: [14, 15, 16], colhedoras: 8, raioMedioKm: 14.2, tchMedio: 84.5 },
        { id: 2, nome: 'Frente 02 - Cana Crua', fazenda: 'Faz. Boa Vista', talhoes: [4, 5], colhedoras: 7, raioMedioKm: 22.8, tchMedio: 82.1 },
        { id: 3, nome: 'Frente 03 - Fornecedores Cooperados', fazenda: 'Faz. Planalto', talhoes: [1, 2], colhedoras: 6, raioMedioKm: 31.5, tchMedio: 86.2 }
      ],
      raioMedioGeralKm: 21.4
    },
    vinhaca: {
      areasAplicacao: [
        { setor: 'Setor Norte - Adutora 1', fazenda: 'Faz. Santa Helena', vazaoM3H: 450, areaTratadaHa: 1240, laminaMm: 35 },
        { setor: 'Setor Leste - Canal 3', fazenda: 'Faz. São Pedro', vazaoM3H: 380, areaTratadaHa: 980, laminaMm: 30 }
      ],
      volumeTotalAplicadoDiaM3: 18200,
      metaFertirrigacao: '100% da vinhaça destinada'
    }
  };
}

module.exports = {
  getMockAgricolaData,
  getMockAgricolaDetalhe,
  getMockIndustriaData,
  getMockProducaoData,
  getMockProducaoSemanalData,
  getMockFrotaData,
  getMockFrotaDisponibilidade,
  getMockLaboratorioData,
  getMockSegurancaData,
  getMockMapasData
};
