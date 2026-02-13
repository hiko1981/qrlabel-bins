import 'server-only';

import { getOptionalEnv } from '@/lib/env';

export function getRpIdFromHeaders(headers: Headers) {
  const configured = getOptionalEnv('RP_ID');
  if (configured) return configured;

  const host = headers.get('host') ?? 'localhost';
  return host.split(':')[0] ?? host;
}

export function getExpectedOriginFromHeaders(headers: Headers) {
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  const host = headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

