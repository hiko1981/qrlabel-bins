-- Web Push subscriptions + bin events + hangtag templates + municipality portals

create extension if not exists "pgcrypto";

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'worker')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  locale text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists push_subscriptions_principal_id_idx on public.push_subscriptions (principal_id);
create index if not exists push_subscriptions_role_idx on public.push_subscriptions (role);
create index if not exists push_subscriptions_revoked_at_idx on public.push_subscriptions (revoked_at);

alter table public.push_subscriptions enable row level security;

-- If you later add Supabase Auth, these policies will work with auth.uid().
-- For now, the app uses the service_role key and enforces access in API routes.
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
on public.push_subscriptions
for select
to authenticated
using (principal_id = auth.uid());

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
on public.push_subscriptions
for insert
to authenticated
with check (principal_id = auth.uid());

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
on public.push_subscriptions
for update
to authenticated
using (principal_id = auth.uid())
with check (principal_id = auth.uid());

create table if not exists public.bin_events (
  id uuid primary key default gen_random_uuid(),
  bin_id uuid not null references public.bins(id) on delete cascade,
  type text not null check (type in (
    'visit_confirmed',
    'emptied_confirmed',
    'tag_issued',
    'misplaced_location_shared'
  )),
  created_by_principal_id uuid references public.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  public_locale text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists bin_events_bin_id_created_at_idx on public.bin_events (bin_id, created_at desc);
create index if not exists bin_events_type_created_at_idx on public.bin_events (type, created_at desc);
create index if not exists bin_events_resolved_at_idx on public.bin_events (resolved_at);

alter table public.bin_events enable row level security;

create table if not exists public.hangtag_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.hangtag_templates enable row level security;

create table if not exists public.municipality_portals (
  municipality text primary key,
  mitid_portal_url text not null,
  created_at timestamptz not null default now()
);

alter table public.municipality_portals enable row level security;
