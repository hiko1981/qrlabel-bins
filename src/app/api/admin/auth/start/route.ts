import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { randomNumericCode, sha256Base64Url } from '@/lib/crypto';
import { getLocaleFromHeaders } from '@/lib/i18n';
import { deliverOtp } from '@/lib/otpDelivery';
import { isAllowedAdminEmail, isAllowedAdminPhone } from '@/lib/adminBootstrap';

const Body = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(3).optional(),
});

function parseList(v: string | undefined) {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  const body = Body.parse(await req.json().catch(() => ({})));
  const email = body.email?.toLowerCase();
  const phone = body.phone;
  const contactType = email ? 'email' : phone ? 'phone' : null;
  const contactValue = email ?? phone ?? null;

  const targets =
    contactType && contactValue
      ? [{ type: contactType, value: contactValue }]
      : [
          ...parseList(process.env.ADMIN_BOOTSTRAP_EMAILS).map((v) => ({ type: 'email' as const, value: v.toLowerCase() })),
          ...parseList(process.env.ADMIN_BOOTSTRAP_PHONES).map((v) => ({ type: 'phone' as const, value: v })),
        ];

  if (targets.length === 0) return new NextResponse('Not allowed', { status: 403 });
  if (contactType && contactValue) {
    const allowed =
      contactType === 'email' ? isAllowedAdminEmail(contactValue) : isAllowedAdminPhone(contactValue);
    if (!allowed) return new NextResponse('Not allowed', { status: 403 });
  }

  const code = randomNumericCode(6);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const locale = getLocaleFromHeaders(req.headers);
  const supabase = getSupabaseAdmin();

  const created: string[] = [];
  for (const t of targets) {
    const allowed =
      t.type === 'email' ? isAllowedAdminEmail(t.value) : isAllowedAdminPhone(t.value);
    if (!allowed) continue;

    const codeHash = sha256Base64Url(`admin:${code}:${t.type}:${t.value}`);
    const { data: verification, error } = await supabase
      .from('admin_verifications')
      .insert({
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
  if (created.length === 0) return new NextResponse('Not allowed', { status: 403 });

  try {
    const toSend = targets.filter((t) => (t.type === 'email' ? isAllowedAdminEmail(t.value) : isAllowedAdminPhone(t.value)));
    const results = await Promise.allSettled(
      toSend.map((t) =>
        deliverOtp({
          target: t.type === 'email' ? { type: 'email', to: t.value } : { type: 'sms', to: t.value },
          code,
          binToken: 'admin',
          role: 'owner',
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
    return new NextResponse(`Kunne ikke sende kode. ${msg}`, { status: 501 });
  }

  const includeCode = process.env.NODE_ENV !== 'production';
  return NextResponse.json({ ok: true, verificationIds: created, devCode: includeCode ? code : undefined });
}
