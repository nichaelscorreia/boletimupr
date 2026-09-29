select mes, desmes, proequi_atu, proequi_ant, alcani_atu, alcani_ant, alchid_atu, alchid_ant, alcpro_atu, alcpro_ant, acupro_atu, acupro_ant
from (
  select decode(a.mes, '09','09', '10','10', '11','11', '12','12', '01','13', '02','14', '03','15', '04','16', '05','17') ordem,
         to_number(a.mes) mes, a.desmes,
         sum(decode(b.cod_safra, :safra, to_number(replace(b.valor,',','.')), 0)) proequi_atu,
         sum(decode(b.cod_safra, :safraAnt, to_number(replace(b.valor,',','.')), 0)) proequi_ant,
         0 alcani_atu, 0 alcani_ant,
         sum(decode(b.cod_safra, :safra, to_number(replace(c.valor,',','.')), 0)) alchid_atu,
         sum(decode(b.cod_safra, :safraAnt, to_number(replace(c.valor,',','.')), 0)) alchid_ant,
         sum(decode(b.cod_safra, :safra, to_number(replace(c.valor,',','.')), 0)) alcpro_atu,
         sum(decode(b.cod_safra, :safraAnt, to_number(replace(c.valor,',','.')), 0)) alcpro_ant,
         sum(decode(b.cod_safra, :safra, to_number(replace(d.valor,',','.')), 0)) acupro_atu,
         sum(decode(b.cod_safra, :safraAnt, to_number(replace(d.valor,',','.')), 0)) acupro_ant
  from (select to_char(to_date(to_char(rownum,'00') || '/01/2000','dd/mm/rrrr'),'mm') mes,
               to_char(to_date(to_char(rownum,'00') || '/01/2000','dd/mm/rrrr'),'Month') desmes
        from all_objects
        where owner = 'RH'
        and rownum <= 12) a,
       (select to_char(datahora,'mm') mes, cod_safra, valor
        from laboratorio.resultado
        where cod_grupoempresa = 2 and cod_empresa = 1 and cod_filial = 1
        and   cod_safra in (:safra, :safraAnt) and codigo_objeto = 90 and nome_variavel = 'PROD_EQ') b,
       (select to_char(datahora,'mm') mes, cod_safra, valor
        from laboratorio.resultado
        where cod_grupoempresa = 2 and cod_empresa = 1 and cod_filial = 1
        and   cod_safra in (:safra, :safraAnt) and codigo_objeto = 47 and nome_variavel = 'ET_PR') c,
       (select to_char(datahora,'mm') mes, cod_safra, valor
        from laboratorio.resultado
        where cod_grupoempresa = 2 and cod_empresa = 1 and cod_filial = 1
        and   cod_safra in (:safra, :safraAnt) and codigo_objeto = 23 and nome_variavel = 'SAP_VH') d
  where a.mes = b.mes (+)
  and   a.mes = c.mes (+)
  and   a.mes = d.mes (+)
  group by a.mes, a.desmes
)
where (proequi_atu > 0 or proequi_ant > 0 or alchid_atu > 0 or alchid_ant > 0 or acupro_atu > 0 or acupro_ant > 0)
order by ordem
