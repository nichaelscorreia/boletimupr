select case when b.cod_fornecedor = 4093 then 1
            when b.cod_fornecedor = 6053 then 3
            when b.cod_fornecedor = 6118 then 4
            when b.cod_fornecedor in (8682, 15088, 8482, 1534, 1558) or
                 b.cod_tipofazenda= 2 then 2
            else 5 end cod_tipoproprietario,
       case when b.cod_fornecedor = 4093 then '1-PROPRIA'
            when b.cod_fornecedor = 6053 then '3-TRIUNFO'
            when b.cod_fornecedor = 6118 then '4-SINIMBU'
            when b.cod_fornecedor in (8682, 15088, 8482, 1534, 1558) or
                 b.cod_tipofazenda= 2 then '2-ACIONISTAS'
            else '5-FORNECEDOR'
            end tipoproprietario,
       b.cod_fornecedor,
       material.fn_buscanomefornec(b.cod_fornecedor, trunc(sysdate)) nomefornecedor,
       a.cod_fazenda, c.descricao fazenda, a.cod_talhao, a.areaproducao, a.rendimentoagricola tch_estimado,
       round(a.rendimentoagricola * a.areaproducao,2) toneladas_estimadas,

      (select sum(iec.pesoliquido) pesliq
       FROM agricola.entradacana ec,
            agricola.itensentradacana iec
       WHERE ec.cod_grupoempresa = 2
       AND   ec.cod_empresa = 1
       AND   ec.cod_filial = 1
       AND   ec.cod_safra = a.cod_safra
       AND   iec.cod_grupoempresa = ec.cod_grupoempresa
       AND   iec.cod_empresa = ec.cod_empresa
       AND   iec.cod_filial = ec.cod_filial
       AND   iec.cod_safra = ec.cod_safra
       AND   iec.cod_entradacana = ec.cod_entradacana
       and   iec.cod_fazenda = a.cod_fazenda
       and   iec.zona = a.zona
       and   iec.cod_talhao = a.cod_talhao
       AND   iec.pesoliquido > 0) toneladas_colhidas,

      (select nvl(sum(aa.toneladas),0) pesliq
       FROM nst_planejamentocolheita aa
       WHERE aa.codsaf = a.cod_safra
       and   aa.codfaz = a.cod_fazenda
       and   aa.codlot = a.cod_talhao
       and   aa.data  <= trunc(sysdate)) toneladas_planejadas,

      (select min(aa.data)
       FROM nst_planejamentocolheita aa
       WHERE aa.codsaf = a.cod_safra
       and   aa.codfaz = a.cod_fazenda
       and   aa.codlot = a.cod_talhao
       and   aa.data  <= trunc(sysdate)) data_prevista_colheita

from agricola.talhao a,
     agricola.historico_fazenda b,
     agricola.fazenda c
where a.cod_safra   = :safra
and   a.cod_fazenda = b.cod_fazenda
and   trunc(sysdate) between b.data_inicio and nvl(b.data_fim, trunc(sysdate))
and   a.cod_fazenda    = c.cod_fazenda
and   a.rendimentoagricola > 0
order by 1, 4, 6, 7
