import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({ eventId: z.string().uuid() });

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  const body =
    contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')
      ? Object.fromEntries((await req.formData()).entries())
      : await req.json();

  const parsed = Body.parse(body);
  const supabase = getSupabaseAdmin();

  const { data: evt, error: evtErr } = await supabase
    .from('bin_events')
    .select('bin_id')
    .eq('id', parsed.eventId)
    .maybeSingle();
  if (evtErr || !evt?.bin_id) return new NextResponse('Not found', { status: 404 });

  const { data: member } = await supabase
    .from('bin_members')
    .select('id')
    .eq('bin_id', evt.bin_id)
    .eq('user_id', sess.userId)
    .eq('role', 'owner')
    .maybeSingle();
  if (!member) return new NextResponse('Forbidden', { status: 403 });

  const { error } = await supabase
    .from('bin_events')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', parsed.eventId);
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.redirect(new URL('/owner', req.url), 303);
}

