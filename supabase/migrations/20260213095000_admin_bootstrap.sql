-- Admin bootstrap (OTP allowlist in env) + admin membership

create table if not exists public.admin_contacts (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (contact_type, contact_value),
  unique (user_id)
);

create index if not exists admin_contacts_lookup_idx
  on public.admin_contacts (contact_type, contact_value);

create table if not exists public.admin_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.admin_verifications (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null check (contact_type in ('email', 'phone')),
  contact_value text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts int not null default 0,
  user_agent text,
  locale text
);

create index if not exists admin_verifications_lookup_idx
  on public.admin_verifications (contact_type, contact_value, created_at desc);

alter table public.admin_contacts enable row level security;
alter table public.admin_members enable row level security;
alter table public.admin_verifications enable row level security;

