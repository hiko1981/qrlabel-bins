-- Per-principal notification preferences (SMS/email/push allowlist)

create table if not exists public.principal_notification_prefs (
  principal_id uuid primary key references public.users(id) on delete cascade,
  push_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.principal_notification_prefs enable row level security;

