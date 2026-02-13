import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fromBase64Url } from '@/lib/base64url';
import { getExpectedOriginFromHeaders, getRpIdFromHeaders } from '@/lib/webauthnServer';
import { setSession } from '@/lib/session';

export const runtime = 'nodejs';

const Body = z.object({
  binToken: z.string().min(6),
  role: z.enum(['owner', 'worker']),
  response: z.any(),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());

  const jar = await cookies();
  const challenge = jar.get('webauthn_login_challenge')?.value;
  jar.set('webauthn_login_challenge', '', { path: '/', maxAge: 0 });
  if (!challenge) return new NextResponse('Missing challenge', { status: 400 });

  const credentialId = body.response?.id;
  if (typeof credentialId !== 'string' || !credentialId) {
    return new NextResponse('Missing credential id', { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: cred, error: credErr } = await supabase
    .from('webauthn_credentials')
    .select('user_id, credential_id, public_key, counter, transports')
    .eq('credential_id', credentialId)
    .maybeSingle();
  if (credErr) return new NextResponse(credErr.message, { status: 500 });
  if (!cred) return new NextResponse('Unknown credential', { status: 404 });

  const { data: binTokenRow } = await supabase
    .from('bin_tokens')
    .select('bin_id')
    .eq('token', body.binToken)
    .maybeSingle();
  if (!binTokenRow?.bin_id) return new NextResponse('Unknown bin token', { status: 404 });

  const { data: member } = await supabase
    .from('bin_members')
    .select('id')
    .eq('bin_id', binTokenRow.bin_id)
    .eq('user_id', cred.user_id)
    .eq('role', body.role)
    .maybeSingle();
  if (!member) return new NextResponse('Not authorized for role', { status: 403 });

  const verification = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge: challenge,
    expectedOrigin: getExpectedOriginFromHeaders(req.headers),
    expectedRPID: getRpIdFromHeaders(req.headers),
    credential: {
      id: cred.credential_id,
      publicKey: fromBase64Url(cred.public_key),
      counter: Number(cred.counter ?? 0),
    },
  });

  if (!verification.verified) return new NextResponse('Authentication failed', { status: 401 });

  const newCounter = verification.authenticationInfo.newCounter;
  const upd = await supabase
    .from('webauthn_credentials')
    .update({ counter: newCounter })
    .eq('credential_id', cred.credential_id);
  if (upd.error) return new NextResponse(upd.error.message, { status: 500 });

  await setSession(cred.user_id);
  return NextResponse.json({ ok: true });
}
