-- Registro dos e-mails automáticos enviados pela Boletim API (ex.: produção diária dos fretistas).
-- Evita envio em duplicidade (reinício do Tomcat) e guarda o histórico. A API cria esta tabela sozinha
-- se ela não existir; este script serve para criar manualmente, se preferir.
--
-- STATUS: E = enviado, F = falhou (a rotina tenta de novo na próxima execução do mesmo dia)

create table nst_email_envio (
  id             number         not null,
  rotina         varchar2(40)   not null,
  data_ref       date           not null,
  cod_fornecedor number         not null,
  fornecedor     varchar2(200),
  destinatario   varchar2(400),
  status         char(1)        not null,
  erro           varchar2(500),
  enviado_em     date           default sysdate not null,
  constraint nst_email_envio_pk primary key (id),
  constraint nst_email_envio_ck check (status in ('E', 'F'))
);

create index nst_email_envio_ix on nst_email_envio (rotina, data_ref, cod_fornecedor);

create sequence nst_email_envio_seq start with 1 increment by 1 nocache;
