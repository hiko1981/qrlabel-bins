-- Bind verifications to a specific claim contact (so email+sms can share the same code safely)

alter table public.contact_verifications
  add column if not exists contact_id uuid references public.bin_claim_contacts(id) on delete cascade;

create index if not exists contact_verifications_contact_id_idx
  on public.contact_verifications (contact_id, created_at desc);

alter table public.claim_tokens
  add column if not exists claim_contact_id uuid references public.bin_claim_contacts(id) on delete set null;

