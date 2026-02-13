import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBinIdByToken } from '@/lib/data';
import { getLocaleFromHeaders } from '@/lib/i18n';
import { randomNumericCode, sha256Base64Url } from '@/lib/crypto';

const Body = z.object({
  binToken: z.string().min(6),
  role: z.enum(['owner', 'worker']),
  email: z.string().email().optional(),
  phone: z.string().min(3).optional(),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const email = body.email?.toLowerCase();
  const phone = body.phone;
  const contactType = email ? 'email' : 'phone';
  const contactValue = email ?? phone;
  if (!contactValue) return new NextResponse('email or phone required', { status: 400 });

  const binId = await getBinIdByToken(body.binToken);
  if (!binId) return new NextResponse('Unknown bin token', { status: 404 });

  const supabase = getSupabaseAdmin();
  const { data: allowed } = await supabase
    .from('bin_claim_contacts')
    .select('id')
    .eq('bin_id', binId)
    .eq('role', body.role)
    .eq(contactType, contactValue)
    .limit(1);
  if (!allowed || allowed.length === 0) return new NextResponse('Not allowed', { status: 403 });

  const code = randomNumericCode(6);
  const codeHash = sha256Base64Url(`${code}:${binId}:${body.role}:${contactType}:${contactValue}`);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const locale = getLocaleFromHeaders(req.headers);
  const { data: verification, error } = await supabase
    .from('contact_verifications')
    .insert({
      bin_id: binId,
      role: body.role,
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

  // MANUAL STEP: integrate email/SMS provider to deliver `code`.
  // In production we do not return the code.
  const includeCode = process.env.NODE_ENV !== 'production';
  return NextResponse.json({ ok: true, verificationId: verification.id, devCode: includeCode ? code : undefined });
}

