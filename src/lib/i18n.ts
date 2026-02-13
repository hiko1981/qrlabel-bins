import 'server-only';

export function getLocaleFromHeaders(headers: Headers) {
  const al = headers.get('accept-language') ?? '';
  const primary = al.split(',')[0]?.trim();
  if (!primary) return null;
  return primary.toLowerCase();
}

