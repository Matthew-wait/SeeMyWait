-- Summary of cities per state, used by the state and city dropdowns.
create table if not exists public.clinic_city_summary (
  state text not null,
  city text not null,
  n bigint not null,
  refreshed_at timestamptz not null default now(),
  primary key (state, city)
);

-- Rebuilds one state's rows. Called per state so no single call runs long.
create or replace function public.refresh_clinic_city_summary(p_state text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  delete from public.clinic_city_summary where state = p_state;
  insert into public.clinic_city_summary (state, city, n, refreshed_at)
  select p_state, c.city, count(*), now()
  from public.clinics c
  where c.state = p_state and c.city is not null and c.city <> ''
  group by c.city;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.refresh_clinic_city_summary(text) from public, anon, authenticated;
