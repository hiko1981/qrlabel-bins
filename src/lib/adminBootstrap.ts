import 'server-only';

import { getOptionalEnv } from '@/lib/env';

function parseList(v: string | undefined) {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string) {
  const list = parseList(getOptionalEnv('ADMIN_BOOTSTRAP_EMAILS')).map((e) => e.toLowerCase());
  return list.includes(email.trim().toLowerCase());
}

export function isAllowedAdminPhone(phone: string) {
  const list = parseList(getOptionalEnv('ADMIN_BOOTSTRAP_PHONES'));
  const normalized = phone.replace(/\s+/g, '');
  return list.map((p) => p.replace(/\s+/g, '')).includes(normalized);
}

