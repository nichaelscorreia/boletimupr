-- Produção dos fretistas — base do e-mail diário: viagens, toneladas e raio médio no dia anterior (D-2), no dia
-- atual (D-1), na semana, no período de fechamento (dia 20 ao dia 19) e na safra, por função do equipamento.
-- 1º SELECT: caminhão da viagem (TRANSPORTE). 2º SELECT: demais equipamentos da carga (ITENSENTRADACANA_EQUIP),
-- agrupados pela função (transporte, julieta, carregamento, reboque, colheita, transbordo, apoio, descarga).
-- Origem: SQL enviado pela usina (4ª versão). Única diferença: os valores fixos viraram parâmetros —
-- :grupoEmpresa, :empresa, :filial, :safra (configuração da API) e :dataRef (dd/mm/aaaa) no lugar de
-- "trunc(sysdate)-1", para permitir prévia e reenvio de um dia específico. A rotina diária usa o dia anterior.
select q.cod_fornecedor, 
       material.fn_buscanomefornec(q.cod_fornecedor, trunc(sysdate)) fornecedor,
       nvl(nst_busca_email_pessoa(p.cod_pessoa),'jose.maria@ibea.com.br') email, 
       1 cod_tipoequipamento, 'TRANSPORTE' descricaotipoequipamento,
       m.cod_equipamento, m.descricao equipamento,
       --dia anterior (D-2)
       count(distinct case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') - 1 then a.cod_entradacana else null end) viagensdiaanterior,
       sum(case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') - 1 then b.pesoliquido else 0 end) pesoliquidodiaanterior,
       round(avg(case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') - 1 then nvl(h.distancia, g.distancia) else null end),2) raiomediodiaanterior,
       --dia atual (D-1 = data de referência)
       count(distinct case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') then a.cod_entradacana else null end) viagensdiaatual,
       sum(case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') then b.pesoliquido else 0 end) pesoliquidodiaatual,
       round(avg(case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') then nvl(h.distancia, g.distancia) else null end),2) raiomediodiaatual,
       --semana (segunda-feira até a data de referência)
       count(distinct case when a.datamovimento between trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'iw') and to_date(:dataRef, 'dd/mm/rrrr') then a.cod_entradacana else null end) viagenssemana,
       sum(case when a.datamovimento between trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'iw') and to_date(:dataRef, 'dd/mm/rrrr') then b.pesoliquido else 0 end) pesoliquidosemana,
       round(avg(case when a.datamovimento between trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'iw') and to_date(:dataRef, 'dd/mm/rrrr') then nvl(h.distancia, g.distancia) else null end),2) raiomediosemana,
       --período de fechamento: do dia 20 ao dia 19 do mês seguinte, até a data de referência
       count(distinct case when a.datamovimento between case when extract(day from to_date(:dataRef, 'dd/mm/rrrr')) >= 20 then trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm') + 19 else add_months(trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm'), -1) + 19 end
                                    and to_date(:dataRef, 'dd/mm/rrrr') then a.cod_entradacana else null end) viagensmes,
       sum(case when a.datamovimento between case when extract(day from to_date(:dataRef, 'dd/mm/rrrr')) >= 20 then trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm') + 19 else add_months(trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm'), -1) + 19 end
                                    and to_date(:dataRef, 'dd/mm/rrrr') then b.pesoliquido else 0 end) pesoliquidomes,
       round(avg(case when a.datamovimento between case when extract(day from to_date(:dataRef, 'dd/mm/rrrr')) >= 20 then trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm') + 19 else add_months(trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm'), -1) + 19 end
                                    and to_date(:dataRef, 'dd/mm/rrrr') then nvl(h.distancia, g.distancia) else null end),2) raiomediomes,
       --safra
       count(distinct a.cod_entradacana) viagenssafra,
       sum(b.pesoliquido) pesoliquidosafra,
       round(avg(nvl(h.distancia, g.distancia)),2) raiomediosafra
from agricola.entradacana a,  
     agricola.itensentradacana b,  
     agricola.fazenda g, 
     agricola.talhao h,
     automotivo.equipamento m, 
     agricola.safra n, 
     material.fornecedor o, 
     rh.pessoa p,
     automotivo.histproprietarioequip q
where n.cod_grupoempresa = :grupoEmpresa 
and   n.cod_empresa      = :empresa 
and   n.cod_filial       = :filial 
and   n.cod_safra        = :safra 
and   a.cod_grupoempresa = n.cod_grupoempresa 
and   a.cod_empresa      = n.cod_empresa 
and   a.cod_filial       = n.cod_filial 
and   a.cod_safra        = n.cod_safra 
and   a.cod_grupoempresa = b.cod_grupoempresa 
and   a.cod_empresa      = b.cod_empresa 
and   a.cod_filial       = b.cod_filial 
and   a.cod_safra        = b.cod_safra 
and   a.cod_entradacana  = b.cod_entradacana 
and   g.cod_fazenda      = b.cod_fazenda 
and   h.cod_fazenda      = b.cod_fazenda
and   h.zona             = b.zona
and   h.cod_talhao       = b.cod_talhao
and   h.cod_safra        = b.cod_safra
and   m.cod_grupoempresa   = a.cod_grupoempresa 
and   m.cod_equipamento    = a.cod_equipamento 
and   q.cod_grupoempresa   = m.cod_grupoempresa
and   q.cod_equipamento    = m.cod_equipamento 
and   a.datamovimento between q.data_inicial and nvl(q.data_final, trunc(sysdate))
and   q.cod_fornecedor     = o.cod_fornecedor 
and   o.cod_pessoa         = p.cod_pessoa 
and   trunc(a.datamovimento) <= to_date(:dataRef, 'dd/mm/rrrr')
group by p.cod_pessoa, q.cod_fornecedor, m.cod_equipamento, m.descricao

union all

select q.cod_fornecedor, 
       material.fn_buscanomefornec(q.cod_fornecedor, trunc(sysdate)) fornecedor,
       nvl(nst_busca_email_pessoa(p.cod_pessoa),'jose.maria@ibea.com.br') email, 
       c.cod_funcao_equip cod_tipoequipamento, 
       case when c.cod_funcao_equip = 1 then 'TRANSPORTE' 
            when c.cod_funcao_equip = 2 then 'JULIETA' 
            when c.cod_funcao_equip = 3 then 'CARREGAMENTO' 
            when c.cod_funcao_equip = 4 then 'REBOQUE' 
            when c.cod_funcao_equip = 5 then 'COLHEITA' 
            when c.cod_funcao_equip = 6 then 'TRANSBORDO' 
            when c.cod_funcao_equip = 7 then 'APOIO' 
            when c.cod_funcao_equip = 8 then 'DESCARGA' end descricaotipoequipamento,
       m.cod_equipamento, m.descricao equipamento,
       --dia anterior (D-2)
       count(distinct case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') - 1 then a.cod_entradacana else null end) viagensdiaanterior,
       sum(case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') - 1 then b.pesoliquido else 0 end) pesoliquidodiaanterior,
       round(avg(case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') - 1 then nvl(h.distancia, g.distancia) else null end),2) raiomediodiaanterior,
       --dia atual (D-1 = data de referência)
       count(distinct case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') then a.cod_entradacana else null end) viagensdiaatual,
       sum(case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') then b.pesoliquido else 0 end) pesoliquidodiaatual,
       round(avg(case when a.datamovimento = to_date(:dataRef, 'dd/mm/rrrr') then nvl(h.distancia, g.distancia) else null end),2) raiomediodiaatual,
       --semana (segunda-feira até a data de referência)
       count(distinct case when a.datamovimento between trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'iw') and to_date(:dataRef, 'dd/mm/rrrr') then a.cod_entradacana else null end) viagenssemana,
       sum(case when a.datamovimento between trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'iw') and to_date(:dataRef, 'dd/mm/rrrr') then b.pesoliquido else 0 end) pesoliquidosemana,
       round(avg(case when a.datamovimento between trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'iw') and to_date(:dataRef, 'dd/mm/rrrr') then nvl(h.distancia, g.distancia) else null end),2) raiomediosemana,
       --período de fechamento: do dia 20 ao dia 19 do mês seguinte, até a data de referência
       count(distinct case when a.datamovimento between case when extract(day from to_date(:dataRef, 'dd/mm/rrrr')) >= 20 then trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm') + 19 else add_months(trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm'), -1) + 19 end
                                    and to_date(:dataRef, 'dd/mm/rrrr') then a.cod_entradacana else null end) viagensmes,
       sum(case when a.datamovimento between case when extract(day from to_date(:dataRef, 'dd/mm/rrrr')) >= 20 then trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm') + 19 else add_months(trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm'), -1) + 19 end
                                    and to_date(:dataRef, 'dd/mm/rrrr') then b.pesoliquido else 0 end) pesoliquidomes,
       round(avg(case when a.datamovimento between case when extract(day from to_date(:dataRef, 'dd/mm/rrrr')) >= 20 then trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm') + 19 else add_months(trunc(to_date(:dataRef, 'dd/mm/rrrr'), 'mm'), -1) + 19 end
                                    and to_date(:dataRef, 'dd/mm/rrrr') then nvl(h.distancia, g.distancia) else null end),2) raiomediomes,
       --safra
       count(distinct a.cod_entradacana) viagenssafra,
       sum(b.pesoliquido) pesoliquidosafra,
       round(avg(nvl(h.distancia, g.distancia)),2) raiomediosafra
from agricola.entradacana a,  
     agricola.itensentradacana b,  
     agricola.itensentradacana_equip c,
     agricola.fazenda g, 
     agricola.talhao h,
     automotivo.equipamento m, 
     agricola.safra n, 
     material.fornecedor o, 
     rh.pessoa p,
     automotivo.histproprietarioequip q
where n.cod_grupoempresa = :grupoEmpresa 
and   n.cod_empresa      = :empresa 
and   n.cod_filial       = :filial 
and   n.cod_safra        = :safra 
and   a.cod_grupoempresa = n.cod_grupoempresa 
and   a.cod_empresa      = n.cod_empresa 
and   a.cod_filial       = n.cod_filial 
and   a.cod_safra        = n.cod_safra 
and   a.cod_grupoempresa = b.cod_grupoempresa 
and   a.cod_empresa      = b.cod_empresa 
and   a.cod_filial       = b.cod_filial 
and   a.cod_safra        = b.cod_safra 
and   a.cod_entradacana  = b.cod_entradacana 
and   b.cod_grupoempresa = c.cod_grupoempresa
and   b.cod_empresa      = c.cod_empresa
and   b.cod_filial       = c.cod_filial
and   b.cod_safra        = c.cod_safra
and   b.cod_entradacana  = c.cod_entradacana
and   b.seq_itensentradacana = c.seq_itensentradacana
and   g.cod_fazenda      = b.cod_fazenda 
and   h.cod_fazenda      = b.cod_fazenda
and   h.zona             = b.zona
and   h.cod_talhao       = b.cod_talhao
and   h.cod_safra        = b.cod_safra
and   c.cod_grupoempresa   = m.cod_grupoempresa 
and   c.cod_equipamento    = m.cod_equipamento 
and   m.cod_grupoempresa   = q.cod_grupoempresa
and   q.cod_equipamento    = m.cod_equipamento 
and   a.datamovimento between q.data_inicial and nvl(q.data_final, trunc(sysdate))
and   q.cod_fornecedor     = o.cod_fornecedor 
and   o.cod_pessoa         = p.cod_pessoa 
and   trunc(a.datamovimento) <= to_date(:dataRef, 'dd/mm/rrrr')
group by p.cod_pessoa, q.cod_fornecedor, c.cod_funcao_equip, m.cod_equipamento, m.descricao

order by fornecedor, cod_fornecedor, cod_tipoequipamento, cod_equipamento
