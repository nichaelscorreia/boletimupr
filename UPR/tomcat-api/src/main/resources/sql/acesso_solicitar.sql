merge into nst_dispositivo_acesso d
using (select :hash token_hash from dual) s
on (d.token_hash = s.token_hash)
when matched then
  update set d.nome = :nome, d.setor = :setor, d.contato = :contato, d.descricao = :descricao,
             d.user_agent = :userAgent, d.ip_cadastro = :ip, d.data_cadastro = sysdate
  where d.status = 'P'
when not matched then
  insert (id, token_hash, nome, setor, contato, descricao, user_agent, ip_cadastro, status, admin, data_cadastro)
  values (nst_dispositivo_acesso_seq.nextval, :hash, :nome, :setor, :contato, :descricao, :userAgent, :ip, 'P', 'N', sysdate)
