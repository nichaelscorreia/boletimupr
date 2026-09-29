select sum(a.tch_estimado * a.area_corte) / nullif(sum(a.area_corte),0) tch_previsto,
       sum(a.producao_realizada) / nullif(sum(a.area_corte),0) tch_realizado
from agricola.ordem_corte_unica a,
     agricola.historico_fazenda b,
     agricola.liberacao_corte c
where a.cod_grupoempresa = 2
and   a.cod_empresa      = 1
and   a.cod_filial       = 1
and   a.cod_safra        = :safra
and   a.data_encerramento is not null
and   a.cod_fazenda      = b.cod_fazenda
and   b.cod_fornecedor   = 4093
and   c.cod_safra        = a.cod_safra
and   c.data_liberacao   = a.data_liberacao
and   c.numero_liberacao = a.numero_liberacao
and   c.cod_fazenda      = a.cod_fazenda
and   c.zona             = a.zona
and   c.cod_talhao       = a.cod_talhao
--and   a.cod_fazenda     <> 2842
and   c.cod_finalidade in (1, 3)
and   trunc(sysdate) between b.data_inicio and nvl(b.data_fim, trunc(sysdate))
