update nst_dispositivo_acesso
set ultimo_acesso = sysdate, ip_ultimo_acesso = :ip
where token_hash = :hash
