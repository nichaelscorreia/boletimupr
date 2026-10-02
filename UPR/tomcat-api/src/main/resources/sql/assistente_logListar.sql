select *
from (select id, to_char(datahora, 'dd/mm/yyyy hh24:mi:ss') datahora, id_dispositivo, quem, ip, conversa, pergunta, resposta,
             situacao, consultas, modelo, segundos, tok_entrada, tok_saida, tok_cache_lido, tok_cache_gravado
      from nst_assistente_log
      order by datahora desc, id)
where rownum <= :limite
