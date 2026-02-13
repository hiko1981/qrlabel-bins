-- Track which claim contacts have already activated access (passkey registered),
-- and persist claim contact on claim_tokens for post-registration activation marking.

alter table public.bin_claim_contacts
  add column if not exists activated_at timestamptz,
  add column if not exists activated_user_id uuid references public.users(id) on delete set null;

alter table public.claim_tokens
  add column if not exists contact_type text check (contact_type in ('email', 'phone')),
  add column if not exists contact_value text;

create index if not exists bin_claim_contacts_activated_idx
  on public.bin_claim_contacts (bin_id, role, activated_at);

