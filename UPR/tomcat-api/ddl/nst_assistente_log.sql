-- Registro das perguntas feitas ao assistente de dados: quem perguntou, quando, a pergunta e a resposta gerada.
-- A Boletim API cria esta tabela sozinha no primeiro uso; este script serve para criar manualmente, se preferir.

create table nst_assistente_log (
  id                 varchar2(36)   not null,   -- identificador do registro (UUID)
  datahora           date           default sysdate not null, -- quando a pergunta foi feita
  id_dispositivo     number(10),                -- NST_DISPOSITIVO_ACESSO.ID de quem perguntou
  quem               varchar2(200),             -- nome e identificação do dispositivo
  ip                 varchar2(45),
  conversa           varchar2(36),              -- perguntas da mesma conversa têm o mesmo valor
  pergunta           varchar2(4000),
  resposta           clob,
  situacao           varchar2(10),              -- OK = respondida; ERRO = não respondida (motivo em RESPOSTA)
  consultas          varchar2(400),             -- fontes de dados consultadas
  modelo             varchar2(60),
  segundos           number(6),                 -- tempo de resposta
  tok_entrada        number(10),
  tok_saida          number(10),
  tok_cache_lido     number(10),
  tok_cache_gravado  number(10),
  constraint nst_assistente_log_pk primary key (id)
);

create index nst_assistente_log_i1 on nst_assistente_log (datahora);

-- Consulta das últimas perguntas:
-- select datahora, quem, pergunta, resposta, situacao, segundos
-- from nst_assistente_log
-- order by datahora desc;
