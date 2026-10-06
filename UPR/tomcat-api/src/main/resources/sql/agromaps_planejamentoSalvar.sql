merge into nst_agromaps_plan_colheita p
using (select :id id from dual) s
on (p.id = s.id)
when matched then
  update set p.lot_name = :lotName, p.codfaz = :codfaz, p.codlot = :codlot, p.nome_fazenda = :nomeFazenda,
             p.data_planejamento = to_date(:data, 'dd/mm/yyyy'),
             p.area = to_number(:area, '9999999990.999'),
             p.producao_estimada = to_number(:producao, '9999999990.999'),
             p.tch_previsto = to_number(:tch, '9999999990.999'),
             p.turmas = :turmas, p.variedade = :variedade, p.data_plantio = :dataPlantio,
             p.idade_cana = :idadeCana, p.data_ultima_colheita = :dataUltimaColheita,
             p.numero_corte = :numeroCorte, p.user_id = :userId, p.atualizado_em = sysdate
when not matched then
  insert (id, lot_name, codfaz, codlot, nome_fazenda, data_planejamento, area, producao_estimada, tch_previsto,
          turmas, variedade, data_plantio, idade_cana, data_ultima_colheita, numero_corte, user_id,
          criado_em, atualizado_em)
  values (:id, :lotName, :codfaz, :codlot, :nomeFazenda, to_date(:data, 'dd/mm/yyyy'),
          to_number(:area, '9999999990.999'), to_number(:producao, '9999999990.999'),
          to_number(:tch, '9999999990.999'), :turmas, :variedade, :dataPlantio, :idadeCana,
          :dataUltimaColheita, :numeroCorte, :userId,
          nvl(to_date(:criadoEm, 'yyyy-mm-dd"T"hh24:mi:ss'), sysdate), sysdate)
