select d.cod_tipoequipamento, e.descricaotipoequipamento, c.cod_equipamento, c.descricao,
       sum(case when a.datamovimento = trunc(sysdate)   then b.pesoliquido else 0 end) hoje,
       sum(case when a.datamovimento = trunc(sysdate)-1 then b.pesoliquido else 0 end) ontem,
       sum(case when a.datamovimento between trunc(sysdate) - 7 and trunc(sysdate)
                then b.pesoliquido else 0 end) semana,
       sum(b.pesoliquido) safra
from agricola.entradacana a,
     agricola.itensentradacana b,
     agricola.itensentradacana_equip f,
     automotivo.equipamento c,
     automotivo.historico_tipoequipamento d,
     automotivo.tipoequipamento e,
     automotivo.histproprietarioequip g
where a.cod_grupoempresa = 1
and   a.cod_empresa      = 20
and   a.cod_filial       = 1
and   a.cod_safra        = :safra
and   a.cod_grupoempresa = b.cod_grupoempresa
and   a.cod_empresa      = b.cod_empresa
and   a.cod_filial       = b.cod_filial
and   a.cod_safra        = b.cod_safra
and   a.cod_entradacana  = b.cod_entradacana
and   b.cod_grupoempresa = f.cod_grupoempresa
and   b.cod_empresa      = f.cod_empresa
and   b.cod_filial       = f.cod_filial
and   b.cod_safra        = f.cod_safra
and   b.cod_entradacana  = f.cod_entradacana
and   b.seq_itensentradacana = f.seq_itensentradacana
and   f.cod_funcao_equip in (3, 5)
and   f.cod_equipamento  = c.cod_equipamento
and   c.cod_equipamento  = d.cod_equipamento
and   trunc(sysdate) between d.data_inicio and nvl(d.data_fim, trunc(sysdate))
and   d.cod_tipoequipamento = e.cod_tipoequipamento
and   trunc(sysdate) between g.data_inicial and nvl(g.data_final, trunc(sysdate))
and   g.cod_equipamento  = c.cod_equipamento
{{FILTRO_CODIGO}}
group by d.cod_tipoequipamento, e.descricaotipoequipamento, c.cod_equipamento, c.descricao
order by c.descricao
