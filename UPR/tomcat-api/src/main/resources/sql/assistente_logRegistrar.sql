insert into nst_assistente_log
  (id, datahora, id_dispositivo, quem, ip, conversa, pergunta, situacao, consultas, modelo, segundos,
   tok_entrada, tok_saida, tok_cache_lido, tok_cache_gravado)
values
  (:id, sysdate - nvl(:segundos, 0) / 86400, :dispositivo, :quem, :ip, :conversa, :pergunta, :situacao, :consultas, :modelo, :segundos,
   :tokEntrada, :tokSaida, :tokCacheLido, :tokCacheGravado)
