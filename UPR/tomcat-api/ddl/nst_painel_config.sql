-- Configurações do painel alteráveis pelo administrador dentro do sistema (ex.: assistente de dados ligado/desligado).
-- A Boletim API cria esta tabela sozinha no primeiro uso; este script serve para criar manualmente, se preferir.

create table nst_painel_config (
  chave         varchar2(60)   not null,
  valor         varchar2(400),
  alterado_por  varchar2(100),
  alterado_em   date           default sysdate not null,
  constraint nst_painel_config_pk primary key (chave)
);
