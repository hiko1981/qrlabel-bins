import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getExpectedOriginFromHeaders, getRpIdFromHeaders } from '@/lib/webauthnServer';
import { toBase64Url } from '@/lib/base64url';
import { getSession, setSession } from '@/lib/session';
import { requireAdminSession } from '@/lib/adminSession';

const Body = z.object({
  response: z.any(),
});

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const guard = await requireAdminSession(sess.userId);
  if (guard) return guard;

  const body = Body.parse(await req.json().catch(() => ({})));

  const jar = await cookies();
  const challenge = jar.get('webauthn_admin_reg_challenge')?.value;
  jar.set('webauthn_admin_reg_challenge', '', { path: '/', maxAge: 0 });
  if (!challenge) return new NextResponse('Missing challenge', { status: 400 });

  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: challenge,
    expectedOrigin: getExpectedOriginFromHeaders(req.headers),
    expectedRPID: getRpIdFromHeaders(req.headers),
  });

  if (!verification.verified || !verification.registrationInfo) {
    return new NextResponse('Registration failed', { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const credential_id = credential.id;
  const public_key = toBase64Url(credential.publicKey);
  const counter = credential.counter;

  const supabase = getSupabaseAdmin();
  const insert = await supabase.from('webauthn_credentials').insert({
    user_id: sess.userId,
    credential_id,
    public_key,
    counter,
  });
  if (insert.error) return new NextResponse(insert.error.message, { status: 500 });

  await setSession(sess.userId);
  return NextResponse.json({ ok: true });
}

