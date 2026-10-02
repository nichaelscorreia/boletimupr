select chave, valor, alterado_por, to_char(alterado_em, 'dd/mm/yyyy hh24:mi') alterado_em
from nst_painel_config
where chave = :chave
