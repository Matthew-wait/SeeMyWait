-- Own password-reset flow for admin users (no Supabase mailer).
-- Tokens are stored as SHA-256 hashes only, expire after one hour, and are single-use.

create table if not exists public.admin_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists admin_password_resets_user_idx on public.admin_password_resets (user_id, created_at desc);

alter table public.admin_password_resets enable row level security;
-- No policies: only the service role (serverless functions) touches this table.

-- Returns the user id only when the email belongs to an admin.
create or replace function public.admin_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  join public.user_roles r on r.user_id = u.id and r.role = 'admin'
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.admin_user_id_by_email(text) from public, anon, authenticated;
