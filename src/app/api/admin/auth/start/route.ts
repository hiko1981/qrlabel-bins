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

export async function POST(req: Request) {
  const body = Body.parse(await req.json().catch(() => ({})));
  const email = body.email?.toLowerCase();
  const phone = body.phone;
  const contactType = email ? 'email' : 'phone';
  const contactValue = email ?? phone;
  if (!contactValue) return new NextResponse('email or phone required', { status: 400 });

  const allowed =
    contactType === 'email' ? isAllowedAdminEmail(contactValue) : isAllowedAdminPhone(contactValue);
  if (!allowed) return new NextResponse('Not allowed', { status: 403 });

  const code = randomNumericCode(6);
  const codeHash = sha256Base64Url(`admin:${code}:${contactType}:${contactValue}`);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const locale = getLocaleFromHeaders(req.headers);
  const supabase = getSupabaseAdmin();
  const { data: verification, error } = await supabase
    .from('admin_verifications')
    .insert({
      contact_type: contactType,
      contact_value: contactValue,
      code_hash: codeHash,
      expires_at: expiresAt,
      user_agent: req.headers.get('user-agent'),
      locale,
    })
    .select('id')
    .single();
  if (error) return new NextResponse(error.message, { status: 500 });

  try {
    await deliverOtp({
      target: contactType === 'email' ? { type: 'email', to: contactValue } : { type: 'sms', to: contactValue },
      code,
      binToken: 'admin',
      role: 'owner',
    });
  } catch (e) {
    const includeCode = process.env.NODE_ENV !== 'production';
    const msg = e instanceof Error ? e.message : String(e);
    if (includeCode) {
      return NextResponse.json({ ok: true, verificationId: verification.id, devCode: code, warning: msg });
    }
    return new NextResponse(`Kunne ikke sende kode. ${msg}`, { status: 501 });
  }

  const includeCode = process.env.NODE_ENV !== 'production';
  return NextResponse.json({ ok: true, verificationId: verification.id, devCode: includeCode ? code : undefined });
}

