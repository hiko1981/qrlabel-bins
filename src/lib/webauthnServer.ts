import 'server-only';

import { getOptionalEnv } from '@/lib/env';

function stripPort(host: string) {
  return host.split(':')[0] ?? host;
}

function getHost(headers: Headers) {
  const forwarded = headers.get('x-forwarded-host');
  const host = forwarded ?? headers.get('host') ?? 'localhost';
  return stripPort(host);
}

export function getRpIdFromHeaders(headers: Headers) {
  const configured = getOptionalEnv('RP_ID');
  if (configured) return configured;

  const host = getHost(headers);
  // Prefer stable rpId across www/non-www for qrlabel.eu
  if (host === 'www.qrlabel.eu') return 'qrlabel.eu';
  return host;
}

export function getExpectedOriginFromHeaders(headers: Headers) {
  const proto = headers.get('x-forwarded-proto') ?? 'http';
  const host = getHost(headers);
  return `${proto}://${host}`;
}
