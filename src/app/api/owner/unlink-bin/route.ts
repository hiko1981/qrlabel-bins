import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBinIdByToken } from '@/lib/data';

const Body = z.object({
  binToken: z.string().min(6),
});

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const ct = req.headers.get('content-type') ?? '';
  const bodyRaw =
    ct.includes('application/json')
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries());
  const body = Body.parse(bodyRaw);

  const binId = await getBinIdByToken(body.binToken);
  if (!binId) return new NextResponse('Unknown bin token', { status: 404 });

  const supabase = getSupabaseAdmin();
  const del = await supabase
    .from('bin_members')
    .delete()
    .eq('bin_id', binId)
    .eq('user_id', sess.userId)
    .eq('role', 'owner');
  if (del.error) return new NextResponse(del.error.message, { status: 500 });

  return NextResponse.redirect(new URL('/owner/bins?mode=remove&ok=1', req.url), 303);
}

