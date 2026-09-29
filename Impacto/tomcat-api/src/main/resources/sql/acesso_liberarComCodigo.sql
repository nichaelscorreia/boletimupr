update nst_dispositivo_acesso
set status = 'A', admin = 'S', data_alteracao_status = sysdate, alterado_por = 'CODIGO DE LIBERACAO'
where token_hash = :hash
