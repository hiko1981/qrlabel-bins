import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getExpectedOriginFromHeaders, getRpIdFromHeaders } from '@/lib/webauthnServer';
import { toBase64Url } from '@/lib/base64url';
import { setSession } from '@/lib/session';

const Body = z.object({
  claimToken: z.string().min(10),
  response: z.any(),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());

  const challenge = cookies().get('webauthn_reg_challenge')?.value;
  cookies().set('webauthn_reg_challenge', '', { path: '/', maxAge: 0 });
  if (!challenge) return new NextResponse('Missing challenge', { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: claim } = await supabase
    .from('claim_tokens')
    .select('token, user_id, role, bin_token, used_at, expires_at')
    .eq('token', body.claimToken)
    .maybeSingle();
  if (!claim) return new NextResponse('Invalid claim token', { status: 400 });
  if (claim.used_at) return new NextResponse('Claim token already used', { status: 400 });
  if (claim.expires_at && new Date(claim.expires_at) <= new Date()) {
    return new NextResponse('Claim token expired', { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: challenge,
    expectedOrigin: getExpectedOriginFromHeaders(req.headers),
    expectedRPID: getRpIdFromHeaders(req.headers),
  });

  if (!verification.verified || !verification.registrationInfo) {
    return new NextResponse('Registration failed', { status: 400 });
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
  const credential_id = toBase64Url(credentialID);
  const public_key = toBase64Url(credentialPublicKey);

  const insert = await supabase.from('webauthn_credentials').insert({
    user_id: claim.user_id,
    credential_id,
    public_key,
    counter,
  });
  if (insert.error) return new NextResponse(insert.error.message, { status: 500 });

  const markUsed = await supabase
    .from('claim_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', claim.token);
  if (markUsed.error) return new NextResponse(markUsed.error.message, { status: 500 });

  await setSession(claim.user_id);
  return NextResponse.json({ ok: true, redirectTo: `/k/${claim.bin_token}` });
}

