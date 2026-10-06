insert into nst_agromaps_usuario (login, user_id, nome, senha_hash, criado_em)
select :login, :userId, :nome, :senhaHash, nvl(to_date(:criadoEm, 'yyyy-mm-dd"T"hh24:mi:ss'), sysdate)
from dual
where not exists (select 1 from nst_agromaps_usuario where login = :login)
