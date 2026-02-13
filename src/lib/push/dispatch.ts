import 'server-only';

import webpush from 'web-push';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVapidKeys } from '@/lib/push/vapid';

type DispatchArgs = {
  binId: string;
  eventType: string;
  payload: unknown;
  url: string;
  locale: string | null;
};

function ensureConfigured() {
  const { publicKey, privateKey, subject } = getVapidKeys();
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function dispatchPushForEvent(args: DispatchArgs) {
  ensureConfigured();
  const supabase = getSupabaseAdmin();

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth,principal_id,role,revoked_at')
    .is('revoked_at', null);
  if (error || !subs || subs.length === 0) return;

  // Filter to owners that are members of this bin
  const { data: ownerMembers, error: memErr } = await supabase
    .from('bin_members')
    .select('user_id')
    .eq('bin_id', args.binId)
    .eq('role', 'owner');
  if (memErr || !ownerMembers) return;
  const ownerIds = new Set(ownerMembers.map((m) => m.user_id));

  const targets = subs.filter((s) => s.role === 'owner' && ownerIds.has(s.principal_id));
  if (targets.length === 0) return;

  const payload = JSON.stringify({
    title: 'QRLABEL Bins',
    body: messageBody(args.eventType, args.locale),
    url: args.url || '/owner',
    eventType: args.eventType,
  });

  await Promise.all(
    targets.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payload,
        );
      } catch (e: unknown) {
        // Auto-revoke invalid subscriptions
        const statusCode = typeof e === 'object' && e && 'statusCode' in e ? (e as { statusCode?: number }).statusCode : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .update({ revoked_at: new Date().toISOString() })
            .eq('endpoint', s.endpoint);
        }
      }
    }),
  );
}

function messageBody(eventType: string, locale: string | null) {
  const isDa = (locale ?? '').startsWith('da');
  switch (eventType) {
    case 'misplaced_location_shared':
      return isDa ? 'Ny lokation delt for en spand.' : 'A new location was shared for a bin.';
    case 'emptied_confirmed':
      return isDa ? 'Spanden er kvitteret tømt.' : 'Bin emptied confirmed.';
    case 'visit_confirmed':
      return isDa ? 'Besøg kvitteret.' : 'Visit confirmed.';
    case 'tag_issued':
      return isDa ? 'Hangtag lagt.' : 'A hangtag was issued.';
    default:
      return isDa ? 'Ny hændelse.' : 'New event.';
  }
}
