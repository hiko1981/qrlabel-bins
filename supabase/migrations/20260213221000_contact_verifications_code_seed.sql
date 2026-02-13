-- Stable resend: store a per-verification seed so the same OTP can be re-sent until consumed.

alter table public.contact_verifications
  add column if not exists code_seed text;

create index if not exists contact_verifications_code_seed_idx
  on public.contact_verifications (code_seed);

