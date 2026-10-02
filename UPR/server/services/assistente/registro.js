// Registro das perguntas feitas ao assistente (tabela NST_ASSISTENTE_LOG no Oracle): quem perguntou, quando,
// a pergunta e a resposta gerada. Roda em segundo plano; uma falha aqui nunca atrapalha a resposta ao usuário.
const crypto = require('crypto');
const oracle = require('../../db/oracle');
const queries = require('../../db/queries');

const TRECHO = 900; // caracteres da resposta por envio (cabe na URL e no limite de texto do Oracle)

const b64 = (texto) => Buffer.from(texto, 'utf8').toString('base64url');
const semControle = (texto, max) => String(texto || '').replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim().slice(0, max);

// O banco grava em Latin-1: símbolos fora dele virariam "¿". Troca os mais comuns por equivalentes simples.
const TROCAS = { '—': '-', '–': '-', '‑': '-', '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...', '•': '-', '→': '->', '←': '<-',
  '≈': '~', '≤': '<=', '≥': '>=', '≠': '<>', '−': '-', '✓': 'ok', '\u00a0': ' ', '\u202f': ' ', '\u2009': ' ' };
const paraLatin1 = (texto) => String(texto || '').replace(/[^\u0000-\u00ff]/gu, c => (c in TROCAS ? TROCAS[c] : '?'));

function trechos(texto) {
  const partes = [];
  for (let i = 0; i < texto.length; i += TRECHO) partes.push(texto.slice(i, i + TRECHO));
  return partes;
}

async function gravar({ dispositivo, quem, ip, conversa, pergunta, resposta, ok, consultas, modelo, segundos, uso }) {
  const id = crypto.randomUUID();
  const dados = {
    id,
    dispositivo,
    quem: semControle(quem, 200) || 'não identificado',
    ip,
    conversa,
    pergunta: b64(paraLatin1(pergunta).slice(0, 1000)),
    situacao: ok ? 'OK' : 'ERRO',
    consultas: semControle((consultas || []).join(', '), 400),
    modelo: semControle(modelo, 60),
    segundos: Math.min(3600, Math.round(segundos || 0)),
    tokEntrada: uso && uso.entrada,
    tokSaida: uso && uso.saida,
    tokCacheLido: uso && uso.cacheLeitura,
    tokCacheGravado: uso && uso.cacheEscrita
  };
  // A API recusa parâmetros vazios como "ausentes": manda só o que tem valor
  for (const k of Object.keys(dados)) if (dados[k] === undefined || dados[k] === null || dados[k] === '') delete dados[k];
  await oracle.executeCommand(queries.assistente.logRegistrar(dados));
  for (const parte of trechos(paraLatin1(resposta))) {
    await oracle.executeCommand(queries.assistente.logResposta(id, b64(parte)));
  }
}

function registrar(dados) {
  gravar(dados).catch(err => console.warn(`Assistente: falha ao registrar a pergunta no log: ${err.message}`));
}

module.exports = { registrar };
