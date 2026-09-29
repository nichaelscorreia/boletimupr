select nvl(a.valor,0) + nvl(b.valor,0) producao, nvl(c.sacos,0) saida, nvl(c.qtdcarros,0) qtdcarros
from (select sum(to_number(replace(valor,',','.'))) valor
      from laboratorio.resultado
      where cod_grupoempresa = 1 and cod_empresa = 1 and cod_filial = 1
      and   cod_safra = :safra and codigo_objeto = 23 and trunc(datahora) <= trunc(sysdate)-1
      and   nome_variavel = 'SAP_VH') a,
     (select sum(valor) valor
      from (select (select to_number(replace(aa.valor,',','.')) * 500
                    from laboratorio.resultado aa
                    where aa.cod_grupoempresa = a.cod_grupoempresa and aa.cod_empresa = a.cod_empresa and aa.cod_filial = a.cod_filial
                    and   aa.cod_safra = a.cod_safra and aa.codigo_objeto = a.codigo_objeto and aa.datahora = a.datahora
                    and   aa.cod_turno = a.cod_turno and aa.numerobatelada = a.numerobatelada and trim(aa.nome_variavel) = 'QTDE_VACUO') valor
            from laboratorio.resultado a
            where a.cod_grupoempresa = 1 and a.cod_empresa = 1 and a.cod_filial = 1 and a.cod_safra = :safra
            and   a.codigo_objeto in (278, 279, 366) and trunc(a.datahora) = trunc(sysdate) and trim(a.nome_variavel) = 'HORA')) b,
     (select (sum(quantidade)*1000)/50 sacos, count(*) qtdcarros
      from faturamento.itensnotasfiscais i, faturamento.notasfiscais n
      where i.cod_grupoempresa = n.cod_grupoempresa and i.cod_empresa = n.cod_empresa and i.cod_filial = n.cod_filial and i.id_nf = n.id_nf
      and   i.cod_produto = 3 and n.dataemissao <= trunc(sysdate) and n.situacao = 0) c
