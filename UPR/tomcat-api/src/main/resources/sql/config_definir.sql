merge into nst_painel_config c
using (select :chave chave from dual) s
on (c.chave = s.chave)
when matched then
  update set c.valor = :valor, c.alterado_por = :por, c.alterado_em = sysdate
when not matched then
  insert (chave, valor, alterado_por, alterado_em)
  values (:chave, :valor, :por, sysdate)
