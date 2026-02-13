-- QRLABEL Bins (Affaldsspand) MVP schema

create extension if not exists "pgcrypto";

create table if not exists public.bins (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  municipality text,
  created_at timestamptz not null default now()
);

create table if not exists public.bin_tokens (
  token text primary key,
  bin_id uuid not null references public.bins(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists bin_tokens_bin_id_idx on public.bin_tokens (bin_id);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.bin_members (
  id uuid primary key default gen_random_uuid(),
  bin_id uuid not null references public.bins(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'worker')),
  created_at timestamptz not null default now(),
  unique (bin_id, user_id, role)
);

create index if not exists bin_members_bin_id_role_idx on public.bin_members (bin_id, role);
create index if not exists bin_members_user_id_idx on public.bin_members (user_id);

create table if not exists public.claim_tokens (
  token text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  bin_token text not null references public.bin_tokens(token) on delete cascade,
  role text not null check (role in ('owner', 'worker')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz
);

create index if not exists claim_tokens_user_id_idx on public.claim_tokens (user_id);
create index if not exists claim_tokens_bin_token_idx on public.claim_tokens (bin_token);

create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[],
  created_at timestamptz not null default now()
);

create index if not exists webauthn_credentials_user_id_idx on public.webauthn_credentials (user_id);

alter table public.bins enable row level security;
alter table public.bin_tokens enable row level security;
alter table public.users enable row level security;
alter table public.bin_members enable row level security;
alter table public.claim_tokens enable row level security;
alter table public.webauthn_credentials enable row level security;
