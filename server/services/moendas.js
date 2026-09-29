// Status das moendas a partir da consulta industria.statusFabrica
// (usado na aba Indústria e na faixa superior do modo TV)

// Enquanto a data atual for anterior a esta, a Moenda A aparece como "Parada de Entre-Safra"
const LIMITE_ENTRE_SAFRA_MOENDA_A = new Date('2026-09-25T00:00:00-03:00');

function montarMoendas(statusRows) {
  const st = (statusRows && statusRows[0]) ? statusRows[0] : {};
  const isMoendaAParadaEntreSafra = new Date() < LIMITE_ENTRE_SAFRA_MOENDA_A;

  return [
    {
      id: 'moenda_a',
      nome: 'Moenda A',
      status: isMoendaAParadaEntreSafra ? 'Parada de Entre-Safra' : (st.STATUS_A || 'RODANDO'),
      statusColor: isMoendaAParadaEntreSafra ? 'slate' : (st.STATUS_A === 'PARADA' ? 'rose' : 'emerald'),
      motivo: isMoendaAParadaEntreSafra ? 'Aguardando início' : (st.MOTIVO_A || 'Sem ocorrências registradas'),
      dataHora: isMoendaAParadaEntreSafra ? '' : (st.DATAHORA_A || ''),
      horaIni: isMoendaAParadaEntreSafra ? '' : (st.HORAINI_A || ''),
      horaFim: isMoendaAParadaEntreSafra ? '' : (st.HORAFIM_A || ''),
      tempo: isMoendaAParadaEntreSafra ? '' : (st.TEMPO_A || '')
    },
    {
      id: 'moenda_b',
      nome: 'Moenda B',
      status: st.STATUS_B || 'RODANDO',
      statusColor: (st.STATUS_B === 'PARADA' ? 'rose' : 'emerald'),
      motivo: st.MOTIVO_B || 'Sem ocorrências registradas',
      dataHora: st.DATAHORA_B || '',
      horaIni: st.HORAINI_B || '',
      horaFim: st.HORAFIM_B || '',
      tempo: st.TEMPO_B || ''
    }
  ];
}

module.exports = { montarMoendas };
