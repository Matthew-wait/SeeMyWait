-- Nightly recount of clinic_city_summary for every state already in the table.
-- Scheduled with pg_cron at 03:15 UTC. Run by hand with:
--   select public.refresh_all_clinic_city_summaries();

create or replace function public.refresh_all_clinic_city_summaries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text;
  total integer := 0;
begin
  -- Large states (CA, NY, TX) take longer than the API statement timeout;
  -- the cron run is not subject to it, so lift the limit for this transaction only.
  set local statement_timeout = 0;
  for st in select distinct state from public.clinic_city_summary order by state loop
    total := total + public.refresh_clinic_city_summary(st);
  end loop;
  return total;
end;
$$;

revoke all on function public.refresh_all_clinic_city_summaries() from public, anon, authenticated;

-- Replace any earlier schedule with the same name, then add it.
select cron.unschedule(jobid) from cron.job where jobname = 'refresh-clinic-city-summary';
select cron.schedule('refresh-clinic-city-summary', '15 3 * * *', $cron$select public.refresh_all_clinic_city_summaries();$cron$);
