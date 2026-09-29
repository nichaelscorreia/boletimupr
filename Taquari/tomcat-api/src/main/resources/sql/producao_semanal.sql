SELECT p.sem, p.periodo, p.datini, p.datfin,
       sum(iec.pesoliquido) cana_entrada,
      (SELECT sum(to_number(replace(B.VALOR,',','.'))) valor
       FROM LABORATORIO.RESULTADO B
       WHERE B.COD_GRUPOEMPRESA = 1
       AND   B.COD_EMPRESA      = 1
       AND   B.COD_FILIAL       = 1
       AND   B.COD_SAFRA        = :safra
       AND   B.CODIGO_OBJETO    = 2
       AND   TRUNC(B.DATAHORA) between p.datini and p.datfin
       AND   B.NOME_VARIAVEL    = 'MOI_CA') CANA_MOIDA,
      (SELECT round(sum(to_number(replace(B.VALOR,',','.')))/
                    (100 * case when trunc(sysdate) between p.datini and p.datfin then trunc(sysdate) - p.datini else 7 end) * 100,0) valor
       FROM LABORATORIO.RESULTADO B
       WHERE B.COD_GRUPOEMPRESA = 1
       AND   B.COD_EMPRESA      = 1
       AND   B.COD_FILIAL       = 1
       AND   B.COD_SAFRA        = :safra
       AND   TRUNC(B.DATAHORA) between p.datini and p.datfin
       AND   B.NOME_VARIAVEL    = 'TAP_OC_AB') EFICIENCIA,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.POL_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) PCC,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.ATR * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) ATR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.AR_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) AR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.PUREZA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) pureza,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.FIBRA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) FIBRA,
       trim(to_char(round(DECODE(SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0)),0,0,
                    SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0) * iec.pesoliquido )/SUM(iec.pesoliquido)),2),'900'))||'h' tq,
      (SELECT sum(to_number(replace(B.VALOR,',','.'))) valor
       FROM LABORATORIO.RESULTADO B
       WHERE B.COD_GRUPOEMPRESA = 1
       AND   B.COD_EMPRESA      = 1
       AND   B.COD_FILIAL       = 1
       AND   B.COD_SAFRA        = :safra
       AND   B.CODIGO_OBJETO    = 90
       AND   TRUNC(B.DATAHORA) between p.datini and p.datfin
       AND   B.NOME_VARIAVEL    = 'PROD_EQ') PRODUCAO_EQUIVALENTE,
      (SELECT sum(to_number(replace(B.VALOR,',','.'))) valor
       FROM LABORATORIO.RESULTADO B
       WHERE B.COD_GRUPOEMPRESA = 1
       AND   B.COD_EMPRESA      = 1
       AND   B.COD_FILIAL       = 1
       AND   B.COD_SAFRA        = :safra
       AND   B.CODIGO_OBJETO    = 47
       AND   TRUNC(B.DATAHORA) between p.datini and p.datfin
       AND   B.NOME_VARIAVEL    = 'ET_PR') PRODUCAO_HIDRATADO,
      (SELECT sum(to_number(replace(B.VALOR,',','.'))) valor
       FROM LABORATORIO.RESULTADO B
       WHERE B.COD_GRUPOEMPRESA = 1
       AND   B.COD_EMPRESA      = 1
       AND   B.COD_FILIAL       = 1
       AND   B.COD_SAFRA        = :safra
       AND   B.CODIGO_OBJETO    = 47
       AND   TRUNC(B.DATAHORA) between p.datini and p.datfin
       AND   B.NOME_VARIAVEL    = 'ETANPR') PRODUCAO_ANIDRO,
      (SELECT sum(to_number(replace(B.VALOR,',','.'))) valor
       FROM LABORATORIO.RESULTADO B
       WHERE B.COD_GRUPOEMPRESA = 1
       AND   B.COD_EMPRESA      = 1
       AND   B.COD_FILIAL       = 1
       AND   B.COD_SAFRA        = :safra
       AND   B.CODIGO_OBJETO    = 23
       AND   TRUNC(B.DATAHORA) between p.datini and p.datfin
       AND   B.NOME_VARIAVEL    = 'SAP_VH') PRODUCAO_ACUCAR
FROM agricola.entradacana ec,
     agricola.itensentradacana iec,
     agricola.analise_pcts a_pcts,
     agricola.safra s,
     agricola.ordem_corte_unica oc,
     agricola.tipocana tc,
    (select datini, datfin, periodo, trim(to_char(rownum,'00')) || 'ª Semana' sem
     from (select to_date(:inicioSafra,'dd/mm/rrrr') + (rownum-1) datini,
                  to_date(:inicioSafra,'dd/mm/rrrr') + (rownum-1) + 6 datfin,
                  to_char(to_date(:inicioSafra,'dd/mm/rrrr') + (rownum-1),'dd/mm/rrrr') || ' à ' ||
                  to_char(to_date(:inicioSafra,'dd/mm/rrrr') + (rownum-1) + 6,'dd/mm/rrrr') periodo,
                  to_char(to_date(:inicioSafra,'dd/mm/rrrr') + (rownum-1),'d') dia
           from all_objects
           where owner = 'RH')
     where dia = '2'
     and   datini <= trunc(sysdate)) p
WHERE s.cod_grupoempresa = 1
AND   s.cod_empresa = 1
AND   s.cod_filial = 1
AND   s.cod_safra = :safra
AND   ec.cod_grupoempresa = s.cod_grupoempresa
AND   ec.cod_empresa = s.cod_empresa
AND   ec.cod_filial = s.cod_Filial
AND   ec.cod_safra = s.cod_Safra
AND   iec.cod_grupoempresa = ec.cod_grupoempresa
AND   iec.cod_empresa = ec.cod_empresa
AND   iec.cod_filial = ec.cod_filial
AND   iec.cod_safra = ec.cod_safra
AND   iec.cod_entradacana = ec.cod_entradacana
AND   iec.pesoliquido > 0
AND   a_pcts.cod_grupoempresa (+) = iec.cod_grupoempresa
AND   a_pcts.cod_empresa (+)= iec.cod_empresa
AND   a_pcts.cod_filial (+)= iec.cod_filial
AND   a_pcts.cod_safra (+)= iec.cod_safra
AND   a_pcts.cod_entradacana (+)= iec.cod_entradacana
AND   a_pcts.seq_itensentradacana (+)= iec.seq_itensentradacana
AND   oc.cod_grupoempresa = iec.cod_grupoempresa
AND   oc.cod_empresa      = iec.cod_empresa
AND   oc.cod_filial       = iec.cod_filial
AND   oc.cod_safra        = iec.cod_safra
AND   oc.numero_ordem     = iec.numeroordemcorte
and   tc.cod_tipocana     = oc.cod_tipocana
and   ec.datamovimento between p.datini and p.datfin
group by p.sem, p.periodo, p.datini, p.datfin
order by p.sem desc
