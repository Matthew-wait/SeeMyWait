-- Summary of specialties per state, used by the specialty dropdown.
create table if not exists public.clinic_specialty_summary (
  state text not null,
  specialty text not null,
  n bigint not null,
  refreshed_at timestamptz not null default now(),
  primary key (state, specialty)
);

alter table public.clinic_specialty_summary enable row level security;
drop policy if exists "specialty summary is readable" on public.clinic_specialty_summary;
create policy "specialty summary is readable"
  on public.clinic_specialty_summary for select
  to anon, authenticated
  using (true);

create or replace function public.refresh_clinic_specialty_summary(p_state text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  delete from public.clinic_specialty_summary where state = p_state;
  insert into public.clinic_specialty_summary (state, specialty, n, refreshed_at)
  select p_state, c.specialty, count(*), now()
  from public.clinics c
  where c.state = p_state and c.specialty is not null and c.specialty <> ''
  group by c.specialty;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.refresh_clinic_specialty_summary(text) from public, anon, authenticated;
