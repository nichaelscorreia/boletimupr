-- Dados do AgroMaps guardados no Oracle: usuários (login do sistema) e planejamento de colheita.
-- A Boletim API cria estas tabelas sozinha no primeiro uso; este script serve para criar manualmente, se preferir.

create table nst_agromaps_usuario (
  login       varchar2(150)  not null,   -- login ou e-mail, sempre em minúsculas
  user_id     varchar2(36)   not null,   -- identificador do usuário no AgroMaps (UUID)
  nome        varchar2(200),
  senha_hash  varchar2(64)   not null,   -- SHA-256 (hex) da senha; a senha em si nunca é gravada
  criado_em   date           default sysdate not null,
  constraint nst_agromaps_usuario_pk primary key (login),
  constraint nst_agromaps_usuario_uk unique (user_id)
);

create table nst_agromaps_plan_colheita (
  id                    varchar2(100)  not null,   -- codfaz_codlot_data (aaaa-mm-dd)
  lot_name              varchar2(200),             -- nome do lote no mapa (ex.: 0001-1001-1)
  codfaz                varchar2(20),
  codlot                varchar2(20),
  nome_fazenda          varchar2(200),
  data_planejamento     date           not null,   -- data prevista para a colheita
  area                  number(12,3),              -- hectares
  producao_estimada     number(14,3),              -- toneladas
  tch_previsto          number(10,3),
  turmas                number(5),
  variedade             varchar2(100),
  data_plantio          varchar2(20),
  idade_cana            varchar2(50),
  data_ultima_colheita  varchar2(20),
  numero_corte          varchar2(20),
  user_id               varchar2(36),              -- NST_AGROMAPS_USUARIO.USER_ID de quem planejou
  criado_em             date           default sysdate not null,
  atualizado_em         date           default sysdate not null,
  constraint nst_agromaps_plan_colheita_pk primary key (id)
);

create index nst_agromaps_plan_colheita_i1 on nst_agromaps_plan_colheita (data_planejamento);

-- Planejamento de colheita de um dia:
-- select nome_fazenda, codfaz, codlot, area, producao_estimada, turmas
-- from nst_agromaps_plan_colheita
-- where data_planejamento = to_date('10/09/2026', 'dd/mm/yyyy')
-- order by codfaz, codlot;
