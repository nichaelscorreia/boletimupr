select q.cod_fornecedor, 
       material.fn_buscanomefornec(q.cod_fornecedor, trunc(sysdate)) fornecedor,
       nvl(nst_busca_email_pessoa(p.cod_pessoa),'jose.maria@ibea.com.br') email, 
       s.cod_tipoequipamento, s.descricaotipoequipamento, 
       --dia
       m.cod_equipamento, m.descricao equipamento,
       count(distinct case when a.datamovimento = trunc(sysdate)-1 then a.cod_entradacana else null end) viagensdia, 
       sum(case when a.datamovimento = trunc(sysdate)-1 then b.pesoliquido else 0 end) pesoliquidodia,
       --semana
       count(distinct case when a.datamovimento between trunc(sysdate-1,'iw') and trunc(sysdate)-1 then a.cod_entradacana else null end) viagenssemana, 
       sum(case when a.datamovimento between trunc(sysdate-1,'iw') and trunc(sysdate)-1 then b.pesoliquido else 0 end) pesoliquidosemana,
       --mes
       count(distinct case when a.datamovimento between trunc(sysdate-1,'mm') and trunc(sysdate)-1 then a.cod_entradacana else null end) viagensmes, 
       sum(case when a.datamovimento between trunc(sysdate-1,'mm') and trunc(sysdate)-1 then b.pesoliquido else 0 end) pesoliquidomes,
       --safra
       count(distinct a.cod_entradacana) viagenssafra, 
       sum(b.pesoliquido) pesoliquidosafra
from agricola.entradacana a,  
     agricola.itensentradacana b,  
     agricola.historico_fazenda d, 
     agricola.analise_pcts e, 
     agricola.analise_imp_mineral f, 
     agricola.fazenda g, 
     agricola.ordem_corte_unica h, 
     agricola.tipocana i, 
     agricola.tipo_corte j, 
     agricola.analise_imp_mineral l, 
     automotivo.equipamento m, 
     agricola.safra n, 
     material.fornecedor o, 
     rh.pessoa p,
     automotivo.histproprietarioequip q,
     automotivo.historico_tipoequipamento r,
     automotivo.tipoequipamento s
where n.cod_grupoempresa = 2 
and   n.cod_empresa      = 1 
and   n.cod_filial       = 1 
and   n.cod_safra        = 16 
and   a.cod_grupoempresa = n.cod_grupoempresa 
and   a.cod_empresa      = n.cod_empresa 
and   a.cod_filial       = n.cod_filial 
and   a.cod_safra        = n.cod_safra 
and   a.cod_grupoempresa = b.cod_grupoempresa 
and   a.cod_empresa      = b.cod_empresa 
and   a.cod_filial       = b.cod_filial 
and   a.cod_safra        = b.cod_safra 
and   a.cod_entradacana  = b.cod_entradacana 
and   b.cod_fazenda      = d.cod_fazenda 
and   a.datamovimento between d.data_inicio and nvl(d.data_fim, a.datamovimento) 
and   e.cod_grupoempresa (+) = b.cod_grupoempresa 
and   e.cod_empresa      (+) = b.cod_empresa 
and   e.cod_filial       (+) = b.cod_filial 
and   e.cod_safra        (+) = b.cod_safra 
and   e.numero_analise   (+) = b.numero_analise 
and   e.seq_itensentradacana (+) = b.seq_itensentradacana 
and   f.cod_grupoempresa (+) = b.cod_grupoempresa 
and   f.cod_empresa      (+) = b.cod_empresa 
and   f.cod_filial       (+) = b.cod_filial 
and   f.cod_safra        (+) = b.cod_safra 
and   f.cod_entradacana  (+) = b.cod_entradacana 
and   f.seq_itensentradacana (+) = b.seq_itensentradacana 
and   f.numero_analise   (+) = b.numero_analise 
and   g.cod_fazenda      = d.cod_fazenda 
and   h.cod_grupoempresa = b.cod_grupoempresa 
and   h.cod_empresa      = b.cod_empresa 
and   h.cod_filial       = b.cod_filial 
and   h.cod_safra        = b.cod_safra 
and   h.numero_ordem     = b.numeroordemcorte 
and   i.cod_tipocana     = h.cod_tipocana 
and   j.cod_tipocorte    = h.cod_tipocorte 
and   l.cod_grupoempresa (+) = b.cod_grupoempresa 
and   l.cod_empresa      (+) = b.cod_empresa 
and   l.cod_filial       (+) = b.cod_filial 
and   l.cod_safra        (+) = b.cod_safra 
and   l.cod_entradacana  (+) = b.cod_entradacana 
and   l.seq_itensentradacana (+) = b.seq_itensentradacana 
and   l.numero_analise   (+) = b.numero_analise 
and   m.cod_grupoempresa   = a.cod_grupoempresa 
and   m.cod_equipamento    = a.cod_equipamento 
and   q.cod_grupoempresa   = m.cod_grupoempresa
and   q.cod_equipamento    = m.cod_equipamento 
and   a.datamovimento between q.data_inicial and nvl(q.data_final, trunc(sysdate))
and   q.cod_fornecedor     = o.cod_fornecedor 
and   o.cod_pessoa         = p.cod_pessoa 
and   m.cod_grupoempresa   = r.cod_grupoempresa
and   m.cod_equipamento    = r.cod_equipamento 
and   a.datamovimento between r.data_inicio and nvl(r.data_fim, trunc(sysdate))
and   r.cod_tipoequipamento= s.cod_tipoequipamento 
and   to_date(trunc(a.datamovimento),'dd/mm/rrrr') <= trunc(sysdate) - 1 
group by p.cod_pessoa, q.cod_fornecedor, s.cod_tipoequipamento, s.descricaotipoequipamento, m.cod_equipamento, m.descricao

union all

select q.cod_fornecedor, 
       material.fn_buscanomefornec(q.cod_fornecedor, trunc(sysdate)) fornecedor,
       nvl(nst_busca_email_pessoa(p.cod_pessoa),'jose.maria@ibea.com.br') email, 
       s.cod_tipoequipamento, s.descricaotipoequipamento, 
       m.cod_equipamento, m.descricao equipamento,
       --dia
       count(distinct case when a.datamovimento = trunc(sysdate)-1 then a.cod_entradacana else null end) viagensdia, 
       sum(case when a.datamovimento = trunc(sysdate)-1 then b.pesoliquido else 0 end) pesoliquidodia,
       --semana
       count(distinct case when a.datamovimento between trunc(sysdate-1,'iw') and trunc(sysdate)-1 then a.cod_entradacana else null end) viagenssemana, 
       sum(case when a.datamovimento between trunc(sysdate-1,'iw') and trunc(sysdate)-1 then b.pesoliquido else 0 end) pesoliquidosemana,
       --mes
       count(distinct case when a.datamovimento between trunc(sysdate-1,'mm') and trunc(sysdate)-1 then a.cod_entradacana else null end) viagensmes, 
       sum(case when a.datamovimento between trunc(sysdate-1,'mm') and trunc(sysdate)-1 then b.pesoliquido else 0 end) pesoliquidomes,
       --safra
       count(distinct a.cod_entradacana) viagenssafra, 
       sum(b.pesoliquido) pesoliquidosafra
from agricola.entradacana a,  
     agricola.itensentradacana b,  
     agricola.itensentradacana_equip c,
     agricola.historico_fazenda d, 
     agricola.analise_pcts e, 
     agricola.analise_imp_mineral f, 
     agricola.fazenda g, 
     agricola.ordem_corte_unica h, 
     agricola.tipocana i, 
     agricola.tipo_corte j, 
     agricola.analise_imp_mineral l, 
     automotivo.equipamento m, 
     agricola.safra n, 
     material.fornecedor o, 
     rh.pessoa p,
     automotivo.histproprietarioequip q,
     automotivo.historico_tipoequipamento r,
     automotivo.tipoequipamento s
where n.cod_grupoempresa = 2 
and   n.cod_empresa      = 1 
and   n.cod_filial       = 1 
and   n.cod_safra        = 16 
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
and   b.cod_fazenda      = d.cod_fazenda 
and   a.datamovimento between d.data_inicio and nvl(d.data_fim, a.datamovimento) 
and   e.cod_grupoempresa (+) = b.cod_grupoempresa 
and   e.cod_empresa      (+) = b.cod_empresa 
and   e.cod_filial       (+) = b.cod_filial 
and   e.cod_safra        (+) = b.cod_safra 
and   e.numero_analise   (+) = b.numero_analise 
and   e.seq_itensentradacana (+) = b.seq_itensentradacana 
and   f.cod_grupoempresa (+) = b.cod_grupoempresa 
and   f.cod_empresa      (+) = b.cod_empresa 
and   f.cod_filial       (+) = b.cod_filial 
and   f.cod_safra        (+) = b.cod_safra 
and   f.cod_entradacana  (+) = b.cod_entradacana 
and   f.seq_itensentradacana (+) = b.seq_itensentradacana 
and   f.numero_analise   (+) = b.numero_analise 
and   g.cod_fazenda      = d.cod_fazenda 
and   h.cod_grupoempresa = b.cod_grupoempresa 
and   h.cod_empresa      = b.cod_empresa 
and   h.cod_filial       = b.cod_filial 
and   h.cod_safra        = b.cod_safra 
and   h.numero_ordem     = b.numeroordemcorte 
and   i.cod_tipocana     = h.cod_tipocana 
and   j.cod_tipocorte    = h.cod_tipocorte 
and   l.cod_grupoempresa (+) = b.cod_grupoempresa 
and   l.cod_empresa      (+) = b.cod_empresa 
and   l.cod_filial       (+) = b.cod_filial 
and   l.cod_safra        (+) = b.cod_safra 
and   l.cod_entradacana  (+) = b.cod_entradacana 
and   l.seq_itensentradacana (+) = b.seq_itensentradacana 
and   l.numero_analise   (+) = b.numero_analise 
and   c.cod_grupoempresa   = m.cod_grupoempresa 
and   c.cod_equipamento    = m.cod_equipamento 
and   m.cod_grupoempresa   = q.cod_grupoempresa
and   m.cod_equipamento    = q.cod_equipamento 
and   a.datamovimento between q.data_inicial and nvl(q.data_final, trunc(sysdate))
and   q.cod_fornecedor     = o.cod_fornecedor 
and   o.cod_pessoa         = p.cod_pessoa 
and   m.cod_grupoempresa   = r.cod_grupoempresa
and   m.cod_equipamento    = r.cod_equipamento 
and   a.datamovimento between r.data_inicio and nvl(r.data_fim, trunc(sysdate))
and   r.cod_tipoequipamento= s.cod_tipoequipamento 
and   to_date(trunc(a.datamovimento),'dd/mm/rrrr') <= trunc(sysdate) - 1 
group by p.cod_pessoa, q.cod_fornecedor, s.cod_tipoequipamento, s.descricaotipoequipamento, m.cod_equipamento, m.descricao

order by fornecedor, cod_fornecedor, descricaotipoequipamento, cod_tipoequipamento, cod_equipamento
