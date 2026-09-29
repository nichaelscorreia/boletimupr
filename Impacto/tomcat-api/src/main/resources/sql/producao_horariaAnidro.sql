select a.hora, a.descricao, nvl(b.valor,0) producao, nvl(c.saida,0) saida, nvl(c.qtdcarros,0) qtdcarros
from (select rownum-1 hora, to_char(rownum-1,'00') || ' a ' || to_char(rownum,'00') descricao
      from all_objects
      where rownum <= to_number(to_char(sysdate,'HH24')) + 1) a,
     (select to_number(substr(trim(a.valor),1,2)) hora,
             sum(to_number(replace(aa.valor,',','.'))) valor
      from laboratorio.resultado a, laboratorio.resultado aa
      where a.cod_grupoempresa = 2 and a.cod_empresa = 1 and a.cod_filial = 1 and a.cod_safra = :safra
      and   a.codigo_objeto = 53 and trunc(a.datahora) = trunc(sysdate) and a.nome_variavel = 'HORA'
      and   aa.cod_grupoempresa = a.cod_grupoempresa and aa.cod_empresa = a.cod_empresa and aa.cod_filial = a.cod_filial
      and   aa.cod_safra = a.cod_safra and aa.codigo_objeto = a.codigo_objeto and aa.datahora = a.datahora
      and   aa.cod_turno = a.cod_turno and aa.numerobatelada = a.numerobatelada and trim(aa.nome_variavel) = 'VOL_ALC'
      group by to_number(substr(trim(a.valor),1,2))) b,
     (select to_number(to_char(datahorasaida,'HH24')) hora, sum(quantidade) saida, count(*) qtdcarros
      from faturamento.itensnotasfiscais i, faturamento.notasfiscais n
      where i.cod_grupoempresa = n.cod_grupoempresa and i.cod_empresa = n.cod_empresa and i.cod_filial = n.cod_filial and i.id_nf = n.id_nf
      and   i.cod_produto in (3, 150) and n.dataemissao = trunc(sysdate) and n.situacao = 0
      group by to_number(to_char(datahorasaida,'HH24'))) c
where a.hora = b.hora (+)
and   a.hora = c.hora (+)
order by a.hora
