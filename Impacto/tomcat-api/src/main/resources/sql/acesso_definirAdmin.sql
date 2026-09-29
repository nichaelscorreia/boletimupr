update nst_dispositivo_acesso
set admin = :admin, data_alteracao_status = sysdate, alterado_por = :por
where id = :id
and   status = 'A'
