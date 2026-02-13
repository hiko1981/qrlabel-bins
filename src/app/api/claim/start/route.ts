import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBinIdByToken } from '@/lib/data';
import { getLocaleFromHeaders } from '@/lib/i18n';
import { randomNumericCode, sha256Base64Url } from '@/lib/crypto';
import { deliverOtp } from '@/lib/otpDelivery';

const Body = z.object({
  binToken: z.string().min(6),
  role: z.enum(['owner', 'worker']),
  email: z.string().email().optional(),
  phone: z.string().min(3).optional(),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const email = body.email?.toLowerCase();
  const phoneRaw = body.phone;
  const phone = phoneRaw
    ? (() => {
        const digits = phoneRaw.replace(/[^\d+]/g, '');
        const onlyDigits = digits.startsWith('+') ? digits.slice(1) : digits;
        if (onlyDigits.startsWith('45') && onlyDigits.length === 10) return onlyDigits.slice(2);
        return onlyDigits;
      })()
    : undefined;
  const contactType = email ? 'email' : phone ? 'phone' : null;
  const contactValue = email ?? phone ?? null;

  const binId = await getBinIdByToken(body.binToken);
  if (!binId) return new NextResponse('Unknown bin token', { status: 404 });

  const supabase = getSupabaseAdmin();
  const { data: contacts, error: contactsErr } = await supabase
    .from('bin_claim_contacts')
    .select('email, phone')
    .eq('bin_id', binId)
    .eq('role', body.role);
  if (contactsErr) return new NextResponse(contactsErr.message, { status: 500 });
  if (!contacts || contacts.length === 0) return new NextResponse('Not allowed', { status: 403 });

  const allowedTargets = contacts
    .flatMap((c) => [
      c.phone ? { type: 'phone' as const, value: String(c.phone) } : null,
      c.email ? { type: 'email' as const, value: String(c.email).toLowerCase() } : null,
    ])
    .filter((x): x is { type: 'phone' | 'email'; value: string } => Boolean(x));

  if (contactType && contactValue) {
    const ok = allowedTargets.some((t) => t.type === contactType && t.value === contactValue);
    if (!ok) return new NextResponse('Not allowed', { status: 403 });
  }

  const code = randomNumericCode(6);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const locale = getLocaleFromHeaders(req.headers);
  const targetsToSend =
    contactType && contactValue
      ? [{ type: contactType as 'email' | 'phone', value: contactValue }]
      : allowedTargets;

  const created: string[] = [];
  for (const t of targetsToSend) {
    const codeHash = sha256Base64Url(`${code}:${binId}:${body.role}:${t.type}:${t.value}`);
    const { data: verification, error } = await supabase
      .from('contact_verifications')
      .insert({
        bin_id: binId,
        role: body.role,
        contact_type: t.type,
        contact_value: t.value,
        code_hash: codeHash,
        expires_at: expiresAt,
        user_agent: req.headers.get('user-agent'),
        locale,
      })
      .select('id')
      .single();
    if (error) return new NextResponse(error.message, { status: 500 });
    created.push(verification.id);
  }

  try {
    const results = await Promise.allSettled(
      targetsToSend.map((t) =>
        deliverOtp({
          target: t.type === 'email' ? { type: 'email', to: t.value } : { type: 'sms', to: t.value },
          code,
          binToken: body.binToken,
          role: body.role,
        }),
      ),
    );
    const ok = results.some((r) => r.status === 'fulfilled');
    if (!ok) {
      const reasons = results
        .filter((r) => r.status === 'rejected')
        .map((r) => String((r as PromiseRejectedResult).reason?.message ?? (r as PromiseRejectedResult).reason));
      throw new Error(reasons.join(' | ') || 'No delivery succeeded');
    }
  } catch (e) {
    const includeCode = process.env.NODE_ENV !== 'production';
    const msg = e instanceof Error ? e.message : String(e);
    if (includeCode) {
      return NextResponse.json({ ok: true, verificationIds: created, devCode: code, warning: msg });
    }
    return new NextResponse(
      `Kunne ikke sende kode. Konfigurér provider env vars. ${msg}`,
      { status: 501 },
    );
  }

  // Do not return code in production.
  const includeCode = process.env.NODE_ENV !== 'production';
  return NextResponse.json({ ok: true, verificationIds: created, devCode: includeCode ? code : undefined });
}
