select cod_fornecedor, nome,
       sum(hoje) hoje, sum(ontem) ontem, sum(semana) semana, sum(safra) safra, sum(litros) litros,
       round(sum(litros)/nullif(sum(safra),0),3) media
from (
  select a.cod_fornecedor, a.nome,
         a.cod_equipamento, a.hoje, a.ontem, a.semana, a.safra,
         sum(b.qtde_litros) litros
  from (
    select g.cod_fornecedor, h.nome,
           f.cod_equipamento,
           sum(case when a.datamovimento = trunc(sysdate)   then b.pesoliquido else 0 end) hoje,
           sum(case when a.datamovimento = trunc(sysdate)-1 then b.pesoliquido else 0 end) ontem,
           sum(case when a.datamovimento between trunc(sysdate) - 7 and trunc(sysdate)
                    then b.pesoliquido else 0 end) semana,
           sum(b.pesoliquido) safra
    from agricola.entradacana a,
         agricola.itensentradacana b,
         automotivo.equipamento c,
         automotivo.historico_tipoequipamento d,
         automotivo.tipoequipamento e,
         automotivo.histproprietarioequip f,
         material.fornecedor g,
         rh.pessoa h
    where a.cod_grupoempresa = 1
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
    and   trunc(sysdate) between f.data_inicial and nvl(f.data_final, trunc(sysdate))
    and   f.cod_equipamento  = c.cod_equipamento
    and  (g.cpf = f.cpf or g.cgc = f.cgc)
    and   f.tipo_proprietario <> 'P'
    and   h.cod_pessoa       = g.cod_pessoa
    group by g.cod_fornecedor, h.nome, f.cod_equipamento
    union
    select 1, ' INDUSTRIAL PORTO RICO S/A' nome,
           a.cod_equipamento,
           sum(case when a.datamovimento = trunc(sysdate)   then b.pesoliquido else 0 end) hoje,
           sum(case when a.datamovimento = trunc(sysdate)-1 then b.pesoliquido else 0 end) ontem,
           sum(case when a.datamovimento between trunc(sysdate) - 7 and trunc(sysdate)
                    then b.pesoliquido else 0 end) semana,
           sum(b.pesoliquido) safra
    from agricola.entradacana a,
         agricola.itensentradacana b,
         automotivo.equipamento c,
         automotivo.historico_tipoequipamento d,
         automotivo.tipoequipamento e,
         automotivo.histproprietarioequip f
    where a.cod_grupoempresa = 1
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
    and   trunc(sysdate) between f.data_inicial and nvl(f.data_final, trunc(sysdate))
    and   f.cod_equipamento  = c.cod_equipamento
    and   f.tipo_proprietario= 'P'
    group by a.cod_equipamento
  ) a, posto.abastecimento b
  where a.cod_equipamento      = b.cod_equipamento (+)
  and   b.cod_grupoempresa (+) = 1
  and   b.cod_empresa      (+) = 1
  and   b.cod_filial       (+) = 1
  and   b.data (+) between trunc(sysdate)-7 and trunc(sysdate)
  group by a.cod_fornecedor, a.nome, a.cod_equipamento, a.hoje, a.ontem, a.semana, a.safra
)
group by cod_fornecedor, nome
order by 1, 2
