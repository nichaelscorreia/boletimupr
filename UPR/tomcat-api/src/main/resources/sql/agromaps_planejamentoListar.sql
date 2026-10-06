select id, lot_name, codfaz, codlot, nome_fazenda,
       to_char(data_planejamento, 'yyyy-mm-dd') data_planejamento,
       area, producao_estimada, tch_previsto, turmas, variedade, data_plantio, idade_cana,
       data_ultima_colheita, numero_corte, user_id,
       to_char(criado_em, 'yyyy-mm-dd"T"hh24:mi:ss') criado_em,
       to_char(atualizado_em, 'yyyy-mm-dd"T"hh24:mi:ss') atualizado_em
from nst_agromaps_plan_colheita
where (:data is null or data_planejamento = to_date(:data, 'dd/mm/yyyy'))
order by data_planejamento, codfaz, codlot
