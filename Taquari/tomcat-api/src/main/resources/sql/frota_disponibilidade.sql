select d.cod_tipoequipamento, e.descricaotipoequipamento, c.cod_equipamento, substr(c.descricao,1,20) descricao,
       case when d.cod_tipoequipamento in (5, 6, 7)   then 'CAMINHAO'
            when d.cod_tipoequipamento in (12, 13) then 'REBOQUE'
            when d.cod_tipoequipamento in (11)     then 'COLHEDORA'
            when d.cod_tipoequipamento in (9, 19)  then 'CARREGADEIRA'
            when d.cod_tipoequipamento in (20)     then 'TRATORES' END tipoequipamento,
      (SELECT COUNT(*)
       FROM AGRICOLA.ENTRADACANA AA, AGRICOLA.ITENSENTRADACANA BB
       WHERE AA.COD_GRUPOEMPRESA   = 1
       AND   AA.COD_EMPRESA        = 1
       AND   AA.COD_FILIAL         = 1
       AND   AA.COD_SAFRA          = :safra
       AND   AA.COD_EQUIPAMENTO    = c.COD_EQUIPAMENTO
       AND   BB.COD_GRUPOEMPRESA   = AA.COD_GRUPOEMPRESA
       AND   BB.COD_EMPRESA        = AA.COD_EMPRESA
       AND   BB.COD_FILIAL         = AA.COD_FILIAL
       AND   BB.COD_SAFRA          = AA.COD_SAFRA
       AND   BB.COD_ENTRADACANA    = AA.COD_ENTRADACANA
       AND   NVL(BB.PESOBRUTO,0)   > 0
       AND   NVL(BB.PESOLIQUIDO,0) = 0
       AND   AA.DATAMOVIMENTO IS NULL) DENTROFABRICA,
      (select nvl(max(aa.numero_ordemservico),0)
       from automotivo.ordemservico aa
       where aa.cod_grupoempresa = 1
       and   aa.cod_empresa      = 1
       and   aa.cod_filial       = 1
       and   aa.dtencerramento is null
       and   aa.cod_equipamento  = c.cod_equipamento) ordemservico,
      (select nvl(max(aa.numero_ordemservico),0)
       from automotivo.ordemservico aa
       where aa.cod_grupoempresa = 1
       and   aa.cod_empresa      = 1
       and   aa.cod_filial       = 1
       and   nvl(aa.cod_planoprevencao,0) > 0
       and   aa.dtencerramento is null
       and   aa.cod_equipamento  = c.cod_equipamento) ordemservicorevisao,
      (select to_char(aa.dtabertura,'dd/mm/rrrr hh24:mi')
       from automotivo.ordemservico aa
       where aa.cod_grupoempresa = 1
       and   aa.cod_empresa      = 1
       and   aa.cod_filial       = 1
       and   aa.dtencerramento is null
       and   aa.cod_equipamento  = c.cod_equipamento) OFICINA
from automotivo.equipamento c,
     automotivo.historico_tipoequipamento d,
     automotivo.tipoequipamento e,
     automotivo.histproprietarioequip f
where c.cod_equipamento   = d.cod_equipamento
and   trunc(sysdate) between d.data_inicio and nvl(d.data_fim, trunc(sysdate))
and   d.cod_tipoequipamento = e.cod_tipoequipamento
and   c.cod_equipamento   = f.cod_equipamento
and   trunc(sysdate) between f.data_inicial and nvl(f.data_final, trunc(sysdate))
and   f.tipo_proprietario = 'P'
and   c.ativo             = 'S'
and   e.cod_tipoequipamento in (5, 6, 7, 12, 13, 9, 11, 19, 20)
and   c.cod_equipamento in (select aa.cod_equipamento
                            from agricola.itensentradacana aa
                            where aa.cod_grupoempresa = 1
                            and   aa.cod_empresa      = 1
                            and   aa.cod_filial       = 1
                            and   aa.cod_safra        = :safra
                            union
                            select bb.cod_equipamento
                            from agricola.itensentradacana_equip bb
                            where bb.cod_grupoempresa = 1
                            and   bb.cod_empresa      = 1
                            and   bb.cod_filial       = 1
                            and   bb.cod_safra        = :safra
                            union
                            select cc.cod_equipamento
                            from posto.abastecimento cc
                            where cc.data >= to_date(:inicioSafra,'dd/mm/rrrr')
                            union
                            select dd.cod_equipamento
                            from automotivo.ordemservico dd
                            where dd.dt_fechamento is null)
order by tipoequipamento, case when ordemservico > 0 then 1 else 0 end desc, case when ordemservicorevisao > 0 then 1 else 0 end, c.cod_equipamento
