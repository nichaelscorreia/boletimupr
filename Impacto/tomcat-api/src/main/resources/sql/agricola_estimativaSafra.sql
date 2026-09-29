select c.pesoliquido + (a.toneladas_estimadas - c.pesoliquido_propria) toneladas_estimadas, a.area_estimada,
       a.toneladas_estimadas toneladas_estimadaspropria,
      (a.toneladas_estimadas - c.pesoliquido_propria - 0) saldo_colher,
    (((a.toneladas_estimadas - c.pesoliquido_propria - 0) / nullif(b.media_hora, 0)) / 24) dias,
    to_char(sysdate + (((a.toneladas_estimadas - c.pesoliquido_propria - 0) / nullif(b.media_hora, 0)) / 24),'dd/mm/rrrr hh24:mi') previsao_termino
from (select sum(a.toneladas_estimadas) toneladas_estimadas,
             sum(a.areaproducao) area_estimada
      from (select a.cod_fazenda, c.descricao, a.cod_talhao, a.areaproducao, a.rendimentoagricola,
                   a.rendimentoagricola * a.areaproducao toneladas_estimadas
            from agricola.talhao a,
                 agricola.historico_fazenda b,
                 agricola.fazenda c
            where a.cod_safra   = :safra
            and   a.cod_fazenda = b.cod_fazenda
            and   trunc(sysdate) between b.data_inicio and nvl(b.data_fim, trunc(sysdate))
            and   b.cod_fornecedor = 4093
            --and   a.cod_fazenda   <> 2842
            and   a.cod_fazenda    = c.cod_fazenda
            and   a.rendimentoagricola > 0) a) a,
     (select sum(b.pesoliquido) pesoliquido,
             sum(b.pesoliquido) / ( (sysdate - (trunc(sysdate)-7)) * 24) media_hora
      from agricola.entradacana a,
           agricola.itensentradacana b
      where a.cod_grupoempresa = 1
      and   a.cod_empresa      = 20
      and   a.cod_filial       = 1
      and   a.cod_safra        = :safra
      and   a.cod_grupoempresa = b.cod_grupoempresa
      and   a.cod_empresa      = b.cod_empresa
      and   a.cod_filial       = b.cod_filial
      and   a.cod_safra        = b.cod_safra
      and   a.cod_entradacana  = b.cod_entradacana
      and   a.datamovimento is not null
      and   trunc(a.datamovimento) >= trunc(sysdate) - 7) b,
     (select sum(case when c.cod_fornecedor >0 -- = 4093
                      then b.pesoliquido else 0 end) pesoliquido_propria,
             sum(b.pesoliquido) pesoliquido
      from agricola.entradacana a,
           agricola.itensentradacana b,
           agricola.historico_fazenda c
      where a.cod_grupoempresa = 1
      and   a.cod_empresa      = 20
      and   a.cod_filial       = 1
      and   a.cod_safra        = :safra
      and   a.cod_grupoempresa = b.cod_grupoempresa
      and   a.cod_empresa      = b.cod_empresa
      and   a.cod_filial       = b.cod_filial
      and   a.cod_safra        = b.cod_safra
      and   a.cod_entradacana  = b.cod_entradacana
      and   b.cod_fazenda      = c.cod_fazenda
      and   a.datamovimento between c.data_inicio and nvl(c.data_fim, trunc(sysdate))) c
