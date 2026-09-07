-- ============================================================================
-- search_clinics hardening — make the DB-first lookup self-sufficiently "smart"
-- ============================================================================
-- The lookup is already case-insensitive (ILIKE + pg_trgm) and typo/word-order
-- tolerant (trigram similarity). This trims/guards the input at the DB level so
-- stray whitespace or NULL can never cause a false miss, independent of the
-- caller. Idempotent (create or replace).
-- ============================================================================

create or replace function public.search_clinics(p_q text, p_lim integer default 8)
returns setof public.clinics
language sql
stable
as $$
  with n as (
    -- collapse internal whitespace + trim, so casing AND spacing never miss
    select btrim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g')) as q
  )
  select c.*
  from public.clinics c, n
  where n.q <> ''
    and c.is_active
    and (
      c.name ilike '%' || n.q || '%'          -- case-insensitive substring
      or c.address ilike '%' || n.q || '%'    -- case-insensitive substring (address)
      or similarity(c.name, n.q) > 0.25       -- typo / word-order tolerant, case-insensitive
    )
  order by
    (lower(c.name) like lower(n.q) || '%') desc,  -- prefix matches first
    similarity(c.name, n.q) desc,
    c.name asc
  limit greatest(1, least(coalesce(p_lim, 8), 25));
$$;
