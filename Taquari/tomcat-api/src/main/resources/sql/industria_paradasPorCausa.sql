-- Horas paradas por causa em cada objeto de parada (2 = Recepção, 3 = Moenda): hoje, ontem e safra.
-- Minutos calculados como na GOT_CALCULO_HORA (fim 00:00 = meia-noite; fim < início = virou o dia).
-- Parada em aberto (sem hora de fim, ou início = fim) conta até agora se for de hoje, ou até 24:00 do dia.
-- Causa 69 (Início de Safra) fica de fora, como na consulta de status das moendas.
select codigo_objeto, cod_causa, causa,
       sum(case when dia = trunc(sysdate)     then minutos else 0 end) min_hoje,
       sum(case when dia = trunc(sysdate) - 1 then minutos else 0 end) min_ontem,
       sum(minutos) min_safra,
       count(*) qtd_safra
from (select a.codigo_objeto, a.cod_causa, trim(b.descricao) causa, trunc(a.datahora) dia,
             greatest(0,
               case
                 when a.horafim is null or a.horafim = a.horaini or not regexp_like(a.horafim, '^[0-9]{2}:[0-9]{2}') then
                   case when trunc(a.datahora) = trunc(sysdate)
                        then to_number(to_char(sysdate, 'hh24')) * 60 + to_number(to_char(sysdate, 'mi'))
                        else 1440 end
                 when substr(a.horafim, 1, 5) = '00:00' then 1440
                 when substr(a.horaini, 1, 2) <= substr(a.horafim, 1, 2) then
                   to_number(substr(a.horafim, 1, 2)) * 60 + to_number(substr(a.horafim, 4, 2))
                 else
                   (to_number(substr(a.horafim, 1, 2)) + 24) * 60 + to_number(substr(a.horafim, 4, 2))
               end
               - (to_number(substr(a.horaini, 1, 2)) * 60 + to_number(substr(a.horaini, 4, 2)))) minutos
      from laboratorio.ocorrencia a,
           laboratorio.causas b
      where a.cod_grupoempresa = 1
      and   a.cod_empresa      = 1
      and   a.cod_filial       = 1
      and   a.codigo_objeto in (2, 3)
      and   a.cod_causa       != 69
      and   a.datahora        >= to_date(:inicioSafra, 'dd/mm/rrrr')
      and   regexp_like(a.horaini, '^[0-9]{2}:[0-9]{2}')
      and   b.cod_grupoempresa = a.cod_grupoempresa
      and   b.cod_empresa      = a.cod_empresa
      and   b.cod_filial       = a.cod_filial
      and   b.codigo           = a.cod_causa)
group by codigo_objeto, cod_causa, causa
order by codigo_objeto, min_safra desc
