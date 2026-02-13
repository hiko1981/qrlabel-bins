-- Bin metadata + contact-based claiming (email/phone) for owner/worker

alter table public.bins
  add column if not exists address_line1 text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists country text,
  add column if not exists waste_stream text;

create table if not exists public.bin_claim_contacts (
  id uuid primary key default gen_random_uuid(),
  bin_id uuid not null references public.bins(id) on delete cascade,
  role text not null check (role in ('owner', 'worker')),
  email text,
  phone text,
  created_at timestamptz not null default now(),
  check ((email is not null) or (phone is not null))
);

create unique index if not exists bin_claim_contacts_unique_email
  on public.bin_claim_contacts (bin_id, role, email)
  where email is not null;

create unique index if not exists bin_claim_contacts_unique_phone
  on public.bin_claim_contacts (bin_id, role, phone)
  where phone is not null;

alter table public.bin_claim_contacts enable row level security;

create table if not exists public.contact_verifications (
  id uuid primary key default gen_random_uuid(),
  bin_id uuid not null references public.bins(id) on delete cascade,
  role text not null check (role in ('owner', 'worker')),
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

create index if not exists contact_verifications_lookup_idx
  on public.contact_verifications (bin_id, role, contact_type, contact_value, created_at desc);

alter table public.contact_verifications enable row level security;
