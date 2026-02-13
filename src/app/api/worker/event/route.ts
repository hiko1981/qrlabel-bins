import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBinIdByToken } from '@/lib/data';
import { dispatchPushForEvent } from '@/lib/push/dispatch';
import { getLocaleFromHeaders } from '@/lib/i18n';

const Body = z.object({
  binToken: z.string().min(6),
  type: z.enum(['visit_confirmed', 'emptied_confirmed', 'tag_issued']),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const body = Body.parse(await req.json());
  const binId = await getBinIdByToken(body.binToken);
  if (!binId) return new NextResponse('Unknown bin token', { status: 404 });

  const supabase = getSupabaseAdmin();
  const locale = getLocaleFromHeaders(req.headers);

  const { data: member } = await supabase
    .from('bin_members')
    .select('id')
    .eq('bin_id', binId)
    .eq('user_id', sess.userId)
    .eq('role', 'worker')
    .maybeSingle();
  if (!member) return new NextResponse('Forbidden', { status: 403 });

  const payload = body.payload ?? {};
  const { data: evt, error } = await supabase
    .from('bin_events')
    .insert({
      bin_id: binId,
      type: body.type,
      created_by_principal_id: sess.userId,
      payload,
      public_locale: locale,
    })
    .select('id')
    .single();
  if (error) return new NextResponse(error.message, { status: 500 });

  await dispatchPushForEvent({
    binId,
    eventType: body.type,
    payload,
    url: `https://qrlabel.one/k/${body.binToken}`,
    locale,
  });

  return NextResponse.json({ ok: true, eventId: evt.id });
}
