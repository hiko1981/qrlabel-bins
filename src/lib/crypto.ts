import 'server-only';

import crypto from 'node:crypto';

export function sha256Base64Url(input: string) {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

export function randomNumericCode(length = 6) {
  const digits = [];
  for (let i = 0; i < length; i++) digits.push(String(crypto.randomInt(0, 10)));
  return digits.join('');
}

