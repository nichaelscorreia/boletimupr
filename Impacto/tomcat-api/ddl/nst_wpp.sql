-- Relatório dos fretistas pelo WhatsApp (Evolution API).
-- A Boletim API cria estes objetos sozinha no primeiro uso; este script serve para criar manualmente, se preferir.

-- Vínculo número de WhatsApp <-> fornecedor/fretista (cadastrado pelo administrador no painel)
create table nst_wpp_fretista (
  id              number(10)     not null,
  cod_fornecedor  number(10)     not null,
  nome            varchar2(200),
  numero          varchar2(20)   not null,
  ativo           char(1)        default 'S' not null,
  criado_por      varchar2(100),
  criado_em       date           default sysdate not null,
  alterado_por    varchar2(100),
  alterado_em     date,
  constraint nst_wpp_fretista_pk primary key (id)
);

create unique index nst_wpp_fretista_u1 on nst_wpp_fretista (cod_fornecedor, numero);

create sequence nst_wpp_fretista_seq start with 1 increment by 1 nocache;

-- Configurações (ATIVO = S/N, HORA = HH:mm do envio diário)
create table nst_wpp_config (
  chave         varchar2(30)   not null,
  valor         varchar2(200),
  alterado_por  varchar2(100),
  alterado_em   date,
  constraint nst_wpp_config_pk primary key (chave)
);

-- Registro de cada envio (origem: A = agendado, M = manual, P = pedido pelo WhatsApp; status: E = enviado, F = falhou)
create table nst_wpp_envio (
  id              number(12)     not null,
  data_ref        date           not null,
  cod_fornecedor  number(10)     not null,
  fornecedor      varchar2(200),
  numero          varchar2(20),
  destino         varchar2(20),
  origem          char(1)        not null,
  status          char(1)        not null,
  erro            varchar2(500),
  enviado_em      date           default sysdate not null,
  constraint nst_wpp_envio_pk primary key (id)
);

create index nst_wpp_envio_i1 on nst_wpp_envio (data_ref, cod_fornecedor, numero);

create sequence nst_wpp_envio_seq start with 1 increment by 1 nocache;
