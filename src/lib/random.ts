import 'server-only';

import crypto from 'node:crypto';

export function randomToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString('base64url');
}

