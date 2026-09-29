select d.cod_tipoequipamento, e.descricaotipoequipamento, a.cod_equipamento, c.descricao,
       sum(case when a.datamovimento = trunc(sysdate)   then b.pesoliquido else 0 end) hoje,
       sum(case when a.datamovimento = trunc(sysdate)-1 then b.pesoliquido else 0 end) ontem,
       sum(case when a.datamovimento between trunc(sysdate) - 7 and trunc(sysdate)
                then b.pesoliquido else 0 end) semana,
       sum(b.pesoliquido) safra
from agricola.entradacana a,
     agricola.itensentradacana b,
     automotivo.equipamento c,
     automotivo.historico_tipoequipamento d,
     automotivo.tipoequipamento e
where a.cod_grupoempresa = 2
and   a.cod_empresa      = 1
and   a.cod_filial       = 1
and   a.cod_safra        = :safra
and   a.cod_grupoempresa = b.cod_grupoempresa
and   a.cod_empresa      = b.cod_empresa
and   a.cod_filial       = b.cod_filial
and   a.cod_safra        = b.cod_safra
and   a.cod_entradacana  = b.cod_entradacana
and   a.cod_equipamento  = c.cod_equipamento
and   c.cod_equipamento  = d.cod_equipamento
and   trunc(sysdate) between d.data_inicio and nvl(d.data_fim, trunc(sysdate))
and   d.cod_tipoequipamento = e.cod_tipoequipamento
{{FILTRO_CODIGO}}
group by d.cod_tipoequipamento, e.descricaotipoequipamento, a.cod_equipamento, c.descricao
order by c.descricao
