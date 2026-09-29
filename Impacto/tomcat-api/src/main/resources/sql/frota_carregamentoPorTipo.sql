select cod_tipoequipamento, descricaotipoequipamento,
       sum(hoje) hoje, sum(ontem) ontem, sum(semana) semana, sum(safra) safra, sum(litros) litros,
       round(sum(litros)/nullif(sum(safra),0),3) media
from (
  select a.cod_tipoequipamento, a.descricaotipoequipamento,
         a.cod_equipamento, a.hoje, a.ontem, a.semana, a.safra,
         sum(b.qtde_litros) litros
  from (
    select d.cod_tipoequipamento, e.descricaotipoequipamento,
           c.cod_equipamento,
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
    where a.cod_grupoempresa = 2
    and   a.cod_empresa      = 1
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
    group by d.cod_tipoequipamento, e.descricaotipoequipamento, c.cod_equipamento
  ) a, posto.abastecimento b
  where a.cod_equipamento      = b.cod_equipamento (+)
  and   b.cod_grupoempresa (+) = 2
  and   b.cod_empresa      (+) = 1
  and   b.cod_filial       (+) = 1
  and   b.data (+) between trunc(sysdate)-7 and trunc(sysdate)
  group by a.cod_tipoequipamento, a.descricaotipoequipamento, a.cod_equipamento, a.hoje, a.ontem, a.semana, a.safra
)
group by cod_tipoequipamento, descricaotipoequipamento
order by 1, 2
