select a.numero, a.codigo_objeto, a.nome_variavel, a.descricao descricao_boletim, b.descricao, b.unidade, b.mascara, b.mascarabanco,
       case when a.codigo_objeto is null then (select max(to_number(replace(bb.valor,',','.')) * decode(trim(a.nome_variavel), 'ART_PCTS', 10, 1))
                                               from laboratorio.resultado bb
                                               where bb.cod_grupoempresa = a.cod_grupoempresa
                                               and   bb.cod_empresa      = a.cod_empresa
                                               and   bb.cod_filial       = a.cod_filial
                                               and   bb.nome_variavel    = a.nome_variavel
                                               and   bb.cod_safra        = :safra
                                               and   bb.cod_turno        = 0
                                               and   bb.datahora between trunc(sysdate)-1 and trunc(sysdate)-1 + 0.99999) else
                                              (select max(to_number(replace(bb.valor,',','.')) * decode(trim(a.nome_variavel), 'ART_PCTS', 10, 1))
                                               from laboratorio.resultado bb
                                               where bb.cod_grupoempresa = a.cod_grupoempresa
                                               and   bb.cod_empresa      = a.cod_empresa
                                               and   bb.cod_filial       = a.cod_filial
                                               and   bb.codigo_objeto    = a.codigo_objeto
                                               and   bb.nome_variavel    = a.nome_variavel
                                               and   bb.cod_turno        = 0
                                               and   bb.cod_safra        = :safra
                                               and   bb.datahora between trunc(sysdate)-1 and trunc(sysdate)-1 + 0.99999) end valor
from laboratorio.linha a, laboratorio.variavel b
where a.cod_grupoempresa = 1
and   a.cod_empresa      = 20
and   a.cod_filial       = 1
and   a.cod_relatorio    = 21
and   a.cod_grupoempresa = b.cod_grupoempresa
and   a.cod_empresa      = b.cod_empresa
and   a.cod_filial       = b.cod_filial
and   a.nome_variavel    = b.nome_variavel
order by a.numero
