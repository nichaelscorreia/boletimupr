update nst_assistente_log
set resposta = resposta || :parte
where id = :id
