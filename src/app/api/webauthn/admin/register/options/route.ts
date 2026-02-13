import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getRpIdFromHeaders } from '@/lib/webauthnServer';
import { getSession } from '@/lib/session';
import { requireAdminSession } from '@/lib/adminSession';

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const guard = await requireAdminSession(sess.userId);
  if (guard) return guard;

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from('webauthn_credentials').select('credential_id').eq('user_id', sess.userId);

  const options = await generateRegistrationOptions({
    rpName: 'QRLABEL Bins',
    rpID: getRpIdFromHeaders(req.headers),
    userID: new TextEncoder().encode(sess.userId),
    userName: `admin:${sess.userId}`,
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
  jar.set('webauthn_admin_reg_challenge', options.challenge, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 5 * 60,
  });

  return NextResponse.json(options);
}
