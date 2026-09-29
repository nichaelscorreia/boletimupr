-- Controle de acesso por dispositivo do Boletim Online de Moagem.
-- Executar UMA vez, conectado com o mesmo usuário usado pela Boletim API (DB_USER do boletim-api.xml).
--
-- Cada navegador (computador, celular, smart TV) recebe um identificador aleatório guardado em cookie;
-- aqui fica apenas o hash SHA-256 dele (TOKEN_HASH), nunca o identificador em si.
--
-- STATUS: P = pendente (aguardando liberação), A = aprovado, B = bloqueado
-- ADMIN : S = o dispositivo pode liberar/bloquear outros dispositivos

create table nst_dispositivo_acesso (
  id                     number         not null,
  token_hash             varchar2(64)   not null,
  nome                   varchar2(100)  not null,
  setor                  varchar2(100),
  contato                varchar2(100),
  descricao              varchar2(100)  not null,
  user_agent             varchar2(400),
  ip_cadastro            varchar2(45),
  status                 char(1)        default 'P' not null,
  admin                  char(1)        default 'N' not null,
  data_cadastro          date           default sysdate not null,
  data_alteracao_status  date,
  alterado_por           varchar2(100),
  ultimo_acesso          date,
  ip_ultimo_acesso       varchar2(45),
  constraint nst_dispositivo_acesso_pk primary key (id),
  constraint nst_dispositivo_acesso_uk unique (token_hash),
  constraint nst_dispositivo_acesso_ck1 check (status in ('P', 'A', 'B')),
  constraint nst_dispositivo_acesso_ck2 check (admin in ('S', 'N'))
);

create sequence nst_dispositivo_acesso_seq start with 1 increment by 1 nocache;

comment on table nst_dispositivo_acesso is 'Dispositivos liberados para acessar o Boletim Online de Moagem';

-- Consultas úteis:
--   Pendentes:            select * from nst_dispositivo_acesso where status = 'P' order by data_cadastro;
--   Liberar manualmente:  update nst_dispositivo_acesso set status = 'A', data_alteracao_status = sysdate, alterado_por = 'SQL' where id = :id;
--   Tornar administrador: update nst_dispositivo_acesso set status = 'A', admin = 'S' where id = :id;
--   Bloquear:             update nst_dispositivo_acesso set status = 'B', data_alteracao_status = sysdate, alterado_por = 'SQL' where id = :id;
