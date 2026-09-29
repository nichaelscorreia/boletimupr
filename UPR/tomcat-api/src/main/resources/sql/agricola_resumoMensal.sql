select 1 tipo, to_char(trunc(ec.datamovimento),'rrrr/mm') anomes,
       case when to_char(trunc(ec.datamovimento),'rrrr/mm') is null then 'TOTAL'
            else max(to_char(trunc(ec.datamovimento),'Month')) end mes,
       sum(iec.pesoliquido) pesliq,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.POL_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) PCC,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.ATR * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) ATR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.AR_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) AR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.PUREZA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) pureza,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.FIBRA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) FIBRA,
       trim(to_char(round(DECODE(SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0)),0,0,
                    SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0) * case when tf.cod_tipofazenda in (1,3,4,6,8,10) then iec.pesoliquido else 0 end)/SUM(iec.pesoliquido)),2),'900'))||'h' tq
FROM agricola.entradacana ec,
     agricola.itensentradacana iec,
     agricola.analise_pcts a_pcts,
     agricola.safra s,
     agricola.ordem_corte_unica oc,
     agricola.tipocana tc,
     agricola.historico_fazenda hf,
     agricola.tipofazenda tf
WHERE s.cod_grupoempresa = 1
AND   s.cod_empresa = 20
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
and   hf.cod_grupoempresa = iec.cod_grupoempresa
and   hf.cod_empresa      = iec.cod_empresa
and   hf.cod_filial       = iec.cod_filial
and   hf.cod_fazenda      = iec.cod_fazenda
and   hf.cod_tipofazenda  = tf.cod_tipofazenda
and   ec.datamovimento between hf.data_inicio and nvl(hf.data_fim, trunc(sysdate))
group by rollup(to_char(trunc(ec.datamovimento),'rrrr/mm'))
union all
select 2 tipo, tf.cod_tipofazenda || '-' || tf.descricao anomes,
       case when tf.cod_tipofazenda || '-' || tf.descricao is null then 'TOTAL'
            else tf.cod_tipofazenda || '-' || tf.descricao end mes,
       sum(iec.pesoliquido) pesliq,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.POL_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) PCC,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.ATR * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) ATR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.AR_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) AR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.PUREZA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) pureza,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.FIBRA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) FIBRA,
       trim(to_char(round(DECODE(SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0)),0,0,
                    SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0) * case when tf.cod_tipofazenda in (1,3,4,6,8,10) then iec.pesoliquido else 0 end)/SUM(iec.pesoliquido)),2),'900'))||'h' tq
FROM agricola.entradacana ec,
     agricola.itensentradacana iec,
     agricola.analise_pcts a_pcts,
     agricola.safra s,
     agricola.ordem_corte_unica oc,
     agricola.tipocana tc,
     agricola.historico_fazenda hf,
     agricola.tipofazenda tf
WHERE s.cod_grupoempresa = 1
AND   s.cod_empresa = 20
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
and   hf.cod_grupoempresa = iec.cod_grupoempresa
and   hf.cod_empresa      = iec.cod_empresa
and   hf.cod_filial       = iec.cod_filial
and   hf.cod_fazenda      = iec.cod_fazenda
and   hf.cod_tipofazenda  = tf.cod_tipofazenda
and   ec.datamovimento between hf.data_inicio and nvl(hf.data_fim, trunc(sysdate))
group by rollup(tf.cod_tipofazenda || '-' || tf.descricao)
order by 1, 2, 3
