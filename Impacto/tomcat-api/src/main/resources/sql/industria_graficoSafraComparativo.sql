select to_char(ec.datamovimento,'mm') anomes,
       decode(to_char(ec.datamovimento,'mm'), '09','09', '10','10', '11','11', '12','12', '01','13', '02','14', '03','15', '04','16', '05','17') ordem,
       sum(decode(ec.cod_safra, :safra, iec.pesoliquido, 0)) safatu,
       sum(decode(ec.cod_safra, :safraAnt, iec.pesoliquido, 0)) safant
FROM agricola.entradacana ec,
     agricola.itensentradacana iec
WHERE ec.cod_grupoempresa = 2
AND   ec.cod_empresa      = 1
AND   ec.cod_filial       = 1
AND   ec.cod_safra in (:safra, :safraAnt)
AND   iec.cod_grupoempresa = ec.cod_grupoempresa
AND   iec.cod_empresa      = ec.cod_empresa
AND   iec.cod_filial       = ec.cod_filial
AND   iec.cod_safra        = ec.cod_safra
AND   iec.cod_entradacana  = ec.cod_entradacana
AND   iec.pesoliquido > 0
group by to_char(ec.datamovimento,'mm')
order by 2
