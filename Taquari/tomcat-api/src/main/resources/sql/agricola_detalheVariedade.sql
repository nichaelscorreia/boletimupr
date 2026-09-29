SELECT '1' tipo, nvl(var.descricao, 'NAO INFORMADA') variedade,
       sum(iec.pesoliquido) pesliq,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.BRIX_EXTRATO * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) BRIX,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.POL_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) PCC,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.FIBRA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) FIBRA,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.ATR * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) ATR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.AR_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) AR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.PUREZA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) pureza,
       trim(to_char(round(DECODE(SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0)),0,0,
                    SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0) * iec.pesoliquido )/SUM(iec.pesoliquido)),2),'900'))||'h' tq
FROM agricola.entradacana ec,
     agricola.itensentradacana iec,
     agricola.analise_pcts a_pcts,
     agricola.safra s,
     agricola.ordem_corte_unica oc,
     agricola.tipocana tc,
     agricola.fazenda fz,
     agricola.tipofazenda tpfz,
     agricola.historico_fazenda htfz,
     rh.pessoa p,
     material.fornecedor f,
     agricola.talhao tal,
     agricola.variedade var
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
AND   oc.cod_grupoempresa  = iec.cod_grupoempresa
AND   oc.cod_empresa       = iec.cod_empresa
AND   oc.cod_filial        = iec.cod_filial
AND   oc.cod_safra         = iec.cod_safra
AND   oc.numero_ordem      = iec.numeroordemcorte
and   tc.cod_tipocana      = oc.cod_tipocana
{{FILTRO_TIPCOL}}
{{FILTRO_TIPO}}
AND   fz.cod_fazenda       = iec.cod_fazenda
AND   iec.cod_fazenda      = htfz.cod_fazenda
AND   htfz.cod_tipofazenda = tpfz.cod_tipofazenda
and   f.cod_fornecedor     = htfz.cod_fornecedor
and   p.cod_pessoa         = f.cod_pessoa
and   tal.cod_safra    (+) = iec.cod_safra
and   tal.cod_fazenda  (+) = iec.cod_fazenda
and   tal.cod_talhao   (+) = iec.cod_talhao
and   var.cod_variedade(+) = tal.cod_variedade
and   ec.datamovimento between htfz.data_inicio and nvl(htfz.data_fim, trunc(sysdate))
and   ec.datamovimento between to_date(:datini,'dd/mm/rrrr') and to_date(:datfin,'dd/mm/rrrr')
and   to_number(substr(ec.horasaida,1,2)) between :horini and :horfin
group by var.descricao
union all
SELECT '2' tipo, 'TOTAL GERAL' variedade,
       sum(iec.pesoliquido) pesliq,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.BRIX_EXTRATO * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) BRIX,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.POL_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) PCC,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.FIBRA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) FIBRA,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.ATR * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) ATR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.AR_CANA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) AR,
       round(DECODE(SUM(A_PCTS.PESOLIQUIDO),0,0,SUM(A_PCTS.PUREZA * A_PCTS.PESOLIQUIDO )/SUM(A_PCTS.PESOLIQUIDO) ),4) pureza,
       trim(to_char(round(DECODE(SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0)),0,0,
                    SUM(iec.qtdehorasposqueima * decode(upper(tc.imprime_posqueima),'S',1,0) * iec.pesoliquido )/SUM(iec.pesoliquido)),2),'900'))||'h' tq
FROM agricola.entradacana ec,
     agricola.itensentradacana iec,
     agricola.analise_pcts a_pcts,
     agricola.safra s,
     agricola.ordem_corte_unica oc,
     agricola.tipocana tc,
     agricola.fazenda fz,
     agricola.tipofazenda tpfz,
     agricola.historico_fazenda htfz,
     rh.pessoa p,
     material.fornecedor f,
     agricola.talhao tal,
     agricola.variedade var
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
AND   oc.cod_grupoempresa  = iec.cod_grupoempresa
AND   oc.cod_empresa       = iec.cod_empresa
AND   oc.cod_filial        = iec.cod_filial
AND   oc.cod_safra         = iec.cod_safra
AND   oc.numero_ordem      = iec.numeroordemcorte
and   tc.cod_tipocana      = oc.cod_tipocana
{{FILTRO_TIPCOL}}
{{FILTRO_TIPO}}
AND   fz.cod_fazenda       = iec.cod_fazenda
AND   iec.cod_fazenda      = htfz.cod_fazenda
AND   htfz.cod_tipofazenda = tpfz.cod_tipofazenda
and   f.cod_fornecedor     = htfz.cod_fornecedor
and   p.cod_pessoa         = f.cod_pessoa
and   tal.cod_safra    (+) = iec.cod_safra
and   tal.cod_fazenda  (+) = iec.cod_fazenda
and   tal.cod_talhao   (+) = iec.cod_talhao
and   var.cod_variedade(+) = tal.cod_variedade
and   ec.datamovimento between htfz.data_inicio and nvl(htfz.data_fim, trunc(sysdate))
and   ec.datamovimento between to_date(:datini,'dd/mm/rrrr') and to_date(:datfin,'dd/mm/rrrr')
and   to_number(substr(ec.horasaida,1,2)) between :horini and :horfin
order by 1, 2
