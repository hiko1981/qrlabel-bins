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
  const norm = (v: string) => {
    const digits = v.replace(/[^\d+]/g, '');
    const onlyDigits = digits.startsWith('+') ? digits.slice(1) : digits;
    // Allow DK numbers entered as +45xxxxxxxx or 45xxxxxxxx
    if (onlyDigits.startsWith('45') && onlyDigits.length === 10) return onlyDigits.slice(2);
    return onlyDigits;
  };
  const normalized = norm(phone);
  return list.map(norm).includes(normalized);
}
