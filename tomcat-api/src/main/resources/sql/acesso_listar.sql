select id, nome, setor, contato, descricao, user_agent, ip_cadastro, status, admin,
       to_char(data_cadastro, 'dd/mm/yyyy hh24:mi') data_cadastro,
       to_char(data_alteracao_status, 'dd/mm/yyyy hh24:mi') data_alteracao_status,
       alterado_por,
       to_char(ultimo_acesso, 'dd/mm/yyyy hh24:mi') ultimo_acesso,
       ip_ultimo_acesso
from nst_dispositivo_acesso
order by case status when 'P' then 0 when 'A' then 1 else 2 end, data_cadastro desc
