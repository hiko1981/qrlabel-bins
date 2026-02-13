import 'server-only';

import { mustGetEnv } from '@/lib/env';

export function getVapidKeys() {
  return {
    publicKey: mustGetEnv('VAPID_PUBLIC_KEY'),
    privateKey: mustGetEnv('VAPID_PRIVATE_KEY'),
    subject: mustGetEnv('PUSH_SUBJECT'),
  };
}

