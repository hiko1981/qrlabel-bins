import 'server-only';

import { getOptionalEnv } from '@/lib/env';

export type OtpDeliveryTarget =
  | { type: 'email'; to: string }
  | { type: 'sms'; to: string };

function toE164Maybe(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.startsWith('45') && digits.length === 10) return `+${digits}`;
  // Assume DK local 8-digit numbers unless already country-prefixed.
  if (digits.length === 8) return `+45${digits}`;
  return `+${digits}`;
}

export async function deliverOtp(params: {
  target: OtpDeliveryTarget;
  code: string;
  binToken: string;
  role: 'owner' | 'worker';
}) {
  const { target, code, binToken, role } = params;

  const appNameRaw = getOptionalEnv('OTP_SENDER_NAME') ?? getOptionalEnv('NEXT_PUBLIC_APP_NAME') ?? 'QRLabel';
  const appName = appNameRaw.trim();
  const msg = `${appName}: din kode er ${code}. (bin ${binToken}, rolle ${role})`;

  if (target.type === 'email') {
    const resendKey = getOptionalEnv('RESEND_API_KEY');
    const resendFrom = getOptionalEnv('RESEND_FROM')?.trim();
    if (!resendKey || !resendFrom) {
      throw new Error('Email provider not configured (RESEND_API_KEY/RESEND_FROM)');
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resendKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [target.to],
        subject: `${appName} – din kode`,
        text: msg,
      }),
    });
    if (!r.ok) throw new Error(`Resend failed: ${r.status} ${await r.text().catch(() => '')}`);
    return;
  }

  const sid = getOptionalEnv('TWILIO_ACCOUNT_SID');
  const token = getOptionalEnv('TWILIO_AUTH_TOKEN');
  const from = getOptionalEnv('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) {
    throw new Error('SMS provider not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER)');
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const form = new URLSearchParams();
  form.set('To', toE164Maybe(target.to));
  form.set('From', from);
  form.set('Body', msg);

  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  if (!r.ok) throw new Error(`Twilio failed: ${r.status} ${await r.text().catch(() => '')}`);
}
