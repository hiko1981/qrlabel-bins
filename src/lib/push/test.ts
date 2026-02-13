import 'server-only';

import webpush from 'web-push';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVapidKeys } from '@/lib/push/vapid';

export async function dispatchTestPushToPrincipal(principalId: string) {
  const { publicKey, privateKey, subject } = getVapidKeys();
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = getSupabaseAdmin();
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth,revoked_at')
    .eq('principal_id', principalId)
    .is('revoked_at', null);
  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    title: 'QRLABEL Bins',
    body: 'Test-notifikation',
    url: '/owner',
    eventType: 'test',
  });

  await Promise.all(
    subs.map((s) =>
      webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        payload,
      ),
    ),
  );
}

