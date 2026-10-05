-- City summary is public, non-sensitive counts used by the state and city dropdowns.
-- Row-level security was on with no policies, so every read returned nothing.
alter table public.clinic_city_summary enable row level security;
drop policy if exists "city summary is readable" on public.clinic_city_summary;
create policy "city summary is readable"
  on public.clinic_city_summary for select
  to anon, authenticated
  using (true);
