select round(sum(case when a.datamovimento = trunc(sysdate) then b.pesoliquido else 0 end) / nullif(to_number(to_char(sysdate,'hh24')) + (to_number(to_char(sysdate,'mi'))/60), 0), 0) hoje,
       round(sum(case when a.datamovimento = trunc(sysdate)-1 then b.pesoliquido else 0 end) / 24, 0) ontem,
       round(sum(b.pesoliquido) / nullif((trunc(sysdate) - to_date(:inicioSafra,'dd/mm/rrrr') + 1) * 24, 0), 0) safra
from agricola.entradacana a,
     agricola.itensentradacana b
where a.cod_grupoempresa = 2
and   a.cod_empresa      = 1
and   a.cod_filial       = 1
and   a.cod_safra        = :safra
and   a.cod_grupoempresa = b.cod_grupoempresa
and   a.cod_empresa      = b.cod_empresa
and   a.cod_filial       = b.cod_filial
and   a.cod_safra        = b.cod_safra
and   a.cod_entradacana  = b.cod_entradacana
and   a.datamovimento >= to_date(:inicioSafra,'dd/mm/rrrr')
