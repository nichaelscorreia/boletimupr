select a.hora, nvl(b.pesliq,0) hoje, nvl(c.pesliq,0) ontem
from (select trim(to_char(rownum - 1, '00')) hora
      from all_objects
      where owner = 'RH'
      and rownum <= 24) a,
     (select substr(a.horasaida,1,2) hora, sum(b.pesoliquido) pesliq
      from agricola.entradacana a,
           agricola.itensentradacana b
      where a.cod_grupoempresa = 1
      and   a.cod_empresa      = 1
      and   a.cod_filial       = 1
      and   a.cod_safra        = :safra
      and   a.cod_grupoempresa = b.cod_grupoempresa
      and   a.cod_empresa      = b.cod_empresa
      and   a.cod_filial       = b.cod_filial
      and   a.cod_safra        = b.cod_safra
      and   a.cod_entradacana  = b.cod_entradacana
      and   a.datamovimento    = trunc(sysdate)
      group by substr(a.horasaida,1,2)) b,
     (select substr(a.horasaida,1,2) hora, sum(b.pesoliquido) pesliq
      from agricola.entradacana a,
           agricola.itensentradacana b
      where a.cod_grupoempresa = 1
      and   a.cod_empresa      = 1
      and   a.cod_filial       = 1
      and   a.cod_safra        = :safra
      and   a.cod_grupoempresa = b.cod_grupoempresa
      and   a.cod_empresa      = b.cod_empresa
      and   a.cod_filial       = b.cod_filial
      and   a.cod_safra        = b.cod_safra
      and   a.cod_entradacana  = b.cod_entradacana
      and   a.datamovimento    = trunc(sysdate) - 1
      group by substr(a.horasaida,1,2)) c
where a.hora = b.hora (+)
and   a.hora = c.hora (+)
order by a.hora
