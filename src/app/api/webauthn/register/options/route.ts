import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getRpIdFromHeaders } from '@/lib/webauthnServer';

export const runtime = 'nodejs';

const Body = z.object({
  claimToken: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const supabase = getSupabaseAdmin();

    const { data: claim, error: claimErr } = await supabase
      .from('claim_tokens')
      .select('token, user_id, role, bin_token, used_at, expires_at')
      .eq('token', body.claimToken)
      .maybeSingle();
    if (claimErr) return new NextResponse(claimErr.message, { status: 500 });
    if (!claim) return new NextResponse('Invalid claim token', { status: 400 });
    if (claim.used_at) return new NextResponse('Claim token already used', { status: 400 });
    if (claim.expires_at && new Date(claim.expires_at) <= new Date()) {
      return new NextResponse('Claim token expired', { status: 400 });
    }

    const { data: existing, error: existingErr } = await supabase
      .from('webauthn_credentials')
      .select('credential_id')
      .eq('user_id', claim.user_id);
    if (existingErr) return new NextResponse(existingErr.message, { status: 500 });

    const options = await generateRegistrationOptions({
      rpName: 'QRLABEL Bins',
      rpID: getRpIdFromHeaders(req.headers),
      userID: claim.user_id,
      userName: `${claim.role}:${claim.user_id}`,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      excludeCredentials: (existing ?? []).map((c) => ({
        id: c.credential_id,
        type: 'public-key',
      })),
    });

    const jar = await cookies();
    jar.set('webauthn_reg_challenge', options.challenge, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 5 * 60,
    });

    return NextResponse.json(options);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg || 'WebAuthn options error', { status: 500 });
  }
}
