import 'server-only';

import webpush from 'web-push';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVapidKeys } from '@/lib/push/vapid';
import { getOptionalEnv } from '@/lib/env';

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
  if (error || !subs) return;

  // Filter to owners that are members of this bin
  const { data: ownerMembers, error: memErr } = await supabase
    .from('bin_members')
    .select('user_id')
    .eq('bin_id', args.binId)
    .eq('role', 'owner');
  if (memErr || !ownerMembers) return;
  const ownerIds = new Set(ownerMembers.map((m) => m.user_id));

  const { data: prefsRows } = await supabase
    .from('principal_notification_prefs')
    .select('principal_id,push_enabled,sms_enabled,email_enabled')
    .in('principal_id', Array.from(ownerIds));
  const prefsMap = new Map<
    string,
    { pushEnabled: boolean; smsEnabled: boolean; emailEnabled: boolean }
  >();
  for (const r of (prefsRows ?? []) as any[]) {
    prefsMap.set(String(r.principal_id), {
      pushEnabled: r.push_enabled ?? true,
      smsEnabled: r.sms_enabled ?? true,
      emailEnabled: r.email_enabled ?? true,
    });
  }

  const pushAllowedOwnerIds = new Set(
    Array.from(ownerIds).filter((id) => (prefsMap.get(id)?.pushEnabled ?? true) === true),
  );

  const targets = (subs ?? []).filter((s) => s.role === 'owner' && pushAllowedOwnerIds.has(s.principal_id));

  const payload = JSON.stringify({
    title: 'QRLABEL Bins',
    body: messageBody(args.eventType, args.locale),
    url: args.url || 'https://qrlabel.eu/owner',
    eventType: args.eventType,
  });

  const pushedTo = new Set<string>();
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
        pushedTo.add(s.principal_id);
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

  // Fallback to SMS/email for owners that did not receive push (or have no subscriptions).
  const fallbackOwnerIds = Array.from(ownerIds).filter((id) => !pushedTo.has(id));
  if (fallbackOwnerIds.length === 0) return;

  const { data: contacts } = await supabase
    .from('bin_claim_contacts')
    .select('activated_user_id,email,phone')
    .eq('bin_id', args.binId)
    .eq('role', 'owner')
    .in('activated_user_id', fallbackOwnerIds);

  const byOwner = new Map<string, { emails: Set<string>; phones: Set<string> }>();
  for (const id of fallbackOwnerIds) byOwner.set(id, { emails: new Set(), phones: new Set() });
  for (const c of (contacts ?? []) as any[]) {
    const uid = c.activated_user_id ? String(c.activated_user_id) : null;
    if (!uid || !byOwner.has(uid)) continue;
    if (c.email) byOwner.get(uid)!.emails.add(String(c.email).toLowerCase());
    if (c.phone) byOwner.get(uid)!.phones.add(String(c.phone));
  }

  const subject = `${messageSubject(args.eventType, args.locale)} – QRLABEL`;
  const text = `${messageBody(args.eventType, args.locale)}\n\nÅbn: https://qrlabel.eu/owner`;
  await Promise.allSettled(
    fallbackOwnerIds.flatMap((ownerId) => {
      const prefs = prefsMap.get(ownerId) ?? { pushEnabled: true, smsEnabled: true, emailEnabled: true };
      const contact = byOwner.get(ownerId);
      const ops: Array<Promise<void>> = [];
      if (prefs.emailEnabled && contact && contact.emails.size > 0) {
        for (const email of contact.emails) ops.push(sendEmail(email, subject, text));
      }
      if (prefs.smsEnabled && contact && contact.phones.size > 0) {
        for (const phone of contact.phones) ops.push(sendSms(phone, `${messageBody(args.eventType, args.locale)} https://qrlabel.eu/owner`));
      }
      return ops;
    }),
  );
}

function sendEmail(to: string, subject: string, text: string) {
  const resendKey = getOptionalEnv('RESEND_API_KEY');
  const resendFrom = getOptionalEnv('RESEND_FROM')?.trim();
  if (!resendKey || !resendFrom) return Promise.resolve();
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${resendKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: resendFrom, to: [to], subject, text }),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`Resend failed: ${r.status} ${await r.text().catch(() => '')}`);
  });
}

function toE164Maybe(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.startsWith('45') && digits.length === 10) return `+${digits}`;
  if (digits.length === 8) return `+45${digits}`;
  return `+${digits}`;
}

function sendSms(to: string, body: string) {
  const sid = getOptionalEnv('TWILIO_ACCOUNT_SID');
  const token = getOptionalEnv('TWILIO_AUTH_TOKEN');
  const from = getOptionalEnv('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) return Promise.resolve();
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const form = new URLSearchParams();
  form.set('To', toE164Maybe(to));
  form.set('From', from);
  form.set('Body', body);
  return fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`Twilio failed: ${r.status} ${await r.text().catch(() => '')}`);
  });
}

function messageSubject(eventType: string, locale: string | null) {
  const isDa = (locale ?? '').startsWith('da');
  switch (eventType) {
    case 'misplaced_location_shared':
      return isDa ? 'Lokation delt' : 'Location shared';
    case 'emptied_confirmed':
      return isDa ? 'Tømning kvitteret' : 'Emptied confirmed';
    case 'visit_confirmed':
      return isDa ? 'Besøg kvitteret' : 'Visit confirmed';
    case 'tag_issued':
      return isDa ? 'Hangtag lagt' : 'Hangtag issued';
    default:
      return isDa ? 'Ny hændelse' : 'New event';
  }
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
