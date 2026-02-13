import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { fromBase64Url } from '@/lib/base64url';
import { getRpIdFromHeaders } from '@/lib/webauthnServer';

const Body = z.object({
  binToken: z.string().min(6),
  role: z.enum(['owner', 'worker']),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const supabase = getSupabaseAdmin();

  const { data: binTokenRow } = await supabase
    .from('bin_tokens')
    .select('bin_id')
    .eq('token', body.binToken)
    .maybeSingle();
  if (!binTokenRow?.bin_id) return new NextResponse('Unknown bin token', { status: 404 });

  const { data: members, error: membersErr } = await supabase
    .from('bin_members')
    .select('user_id')
    .eq('bin_id', binTokenRow.bin_id)
    .eq('role', body.role);
  if (membersErr) return new NextResponse(membersErr.message, { status: 500 });
  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return new NextResponse('No users for role', { status: 404 });

  const { data: creds, error: credsErr } = await supabase
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .in('user_id', userIds);
  if (credsErr) return new NextResponse(credsErr.message, { status: 500 });
  if (!creds || creds.length === 0) return new NextResponse('No credentials registered', { status: 404 });

  const options = await generateAuthenticationOptions({
    rpID: getRpIdFromHeaders(req.headers),
    userVerification: 'required',
    allowCredentials: creds.map((c) => ({
      id: fromBase64Url(c.credential_id),
      type: 'public-key',
      transports: (c.transports ?? undefined) as any,
    })),
  });

  cookies().set('webauthn_login_challenge', options.challenge, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 5 * 60,
  });

  return NextResponse.json(options);
}

