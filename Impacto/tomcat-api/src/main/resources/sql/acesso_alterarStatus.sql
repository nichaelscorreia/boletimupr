update nst_dispositivo_acesso
set status = :status, data_alteracao_status = sysdate, alterado_por = :por
where id = :id
