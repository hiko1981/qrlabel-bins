import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getRpIdFromHeaders } from '@/lib/webauthnServer';

export async function POST(req: Request) {
  const supabase = getSupabaseAdmin();

  const { data: admins, error: adminErr } = await supabase.from('admin_members').select('user_id');
  if (adminErr) return new NextResponse(adminErr.message, { status: 500 });
  const userIds = (admins ?? []).map((a) => a.user_id);
  if (userIds.length === 0) return new NextResponse('No admins configured', { status: 404 });

  const { data: creds, error: credsErr } = await supabase
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .in('user_id', userIds);
  if (credsErr) return new NextResponse(credsErr.message, { status: 500 });
  if (!creds || creds.length === 0) return new NextResponse('No admin credentials registered', { status: 404 });

  const options = await generateAuthenticationOptions({
    rpID: getRpIdFromHeaders(req.headers),
    userVerification: 'required',
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      type: 'public-key',
      transports: c.transports ?? undefined,
    })),
  });

  const jar = await cookies();
  jar.set('webauthn_admin_login_challenge', options.challenge, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 5 * 60,
  });

  return NextResponse.json(options);
}

