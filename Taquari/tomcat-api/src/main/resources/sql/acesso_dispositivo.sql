select id, nome, descricao, status, admin
from nst_dispositivo_acesso
where token_hash = :hash
