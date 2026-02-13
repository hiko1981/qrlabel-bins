import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getLocaleFromHeaders } from '@/lib/i18n';

const Body = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  role: z.enum(['owner', 'worker']),
  userAgent: z.string().optional(),
});

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const body = Body.parse(await req.json());
  const locale = getLocaleFromHeaders(req.headers);
  const supabase = getSupabaseAdmin();

  // Ensure the principal actually has this role on at least one bin.
  const { data: membership, error: membershipErr } = await supabase
    .from('bin_members')
    .select('id')
    .eq('user_id', sess.userId)
    .eq('role', body.role)
    .limit(1);
  if (membershipErr) return new NextResponse(membershipErr.message, { status: 500 });
  if (!membership || membership.length === 0) return new NextResponse('Forbidden', { status: 403 });

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      principal_id: sess.userId,
      role: body.role,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_agent: body.userAgent ?? null,
      locale,
      revoked_at: null,
    },
    { onConflict: 'endpoint' },
  );
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
