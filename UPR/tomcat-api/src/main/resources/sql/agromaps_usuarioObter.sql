select login, user_id, nome, senha_hash, to_char(criado_em, 'yyyy-mm-dd"T"hh24:mi:ss') criado_em
from nst_agromaps_usuario
where login = :login
