import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getExpectedOriginFromHeaders, getRpIdFromHeaders } from '@/lib/webauthnServer';
import { toBase64Url } from '@/lib/base64url';
import { setSession } from '@/lib/session';

export const runtime = 'nodejs';

const Body = z.object({
  claimToken: z.string().min(10),
  response: z.any(),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());

  const jar = await cookies();
  const challenge = jar.get('webauthn_reg_challenge')?.value;
  jar.set('webauthn_reg_challenge', '', { path: '/', maxAge: 0 });
  if (!challenge) return new NextResponse('Missing challenge', { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: claim } = await supabase
    .from('claim_tokens')
    .select('token, user_id, role, bin_token, used_at, expires_at, contact_type, contact_value, claim_contact_id')
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

  const { credential } = verification.registrationInfo;
  const credential_id = credential.id;
  const public_key = toBase64Url(credential.publicKey);
  const counter = credential.counter;

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

  if (claim.claim_contact_id) {
    await supabase
      .from('bin_claim_contacts')
      .update({ activated_at: new Date().toISOString(), activated_user_id: claim.user_id })
      .eq('id', claim.claim_contact_id)
      .is('activated_at', null);

    // Pooling: if multiple inactive bins have the same credentials, auto-activate them all.
    // This lets admin pre-create many bins with the same owner/worker contact and have one activation unlock the rest.
    const { data: activatedContact } = await supabase
      .from('bin_claim_contacts')
      .select('email,phone,role')
      .eq('id', claim.claim_contact_id)
      .maybeSingle();

    const email = (activatedContact?.email ?? null) as string | null;
    const phone = (activatedContact?.phone ?? null) as string | null;
    const clauses: string[] = [];
    if (email) clauses.push(`email.eq.${email.toLowerCase()}`);
    if (phone) clauses.push(`phone.eq.${phone}`);

    if (clauses.length > 0) {
      const { data: otherContacts } = await supabase
        .from('bin_claim_contacts')
        .select('id,bin_id')
        .eq('role', claim.role)
        .is('activated_at', null)
        .or(clauses.join(','))
        .limit(500);

      const ids = (otherContacts ?? []).map((c) => c.id as string);
      const binIds = (otherContacts ?? []).map((c) => c.bin_id as string);

      if (binIds.length > 0) {
        await supabase.from('bin_members').upsert(
          binIds.map((bin_id) => ({ bin_id, user_id: claim.user_id, role: claim.role })),
          { onConflict: 'bin_id,user_id,role' },
        );
      }

      if (ids.length > 0) {
        await supabase
          .from('bin_claim_contacts')
          .update({ activated_at: new Date().toISOString(), activated_user_id: claim.user_id })
          .in('id', ids)
          .is('activated_at', null);
      }
    }
  }

  await setSession(claim.user_id);
  return NextResponse.json({ ok: true, redirectTo: `/k/${claim.bin_token}` });
}
