import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({
  endpoint: z.string().url(),
});

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const body = Body.parse(await req.json());
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('endpoint', body.endpoint)
    .eq('principal_id', sess.userId);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

