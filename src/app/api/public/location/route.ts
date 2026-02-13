import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBinIdByToken } from '@/lib/data';
import { getLocaleFromHeaders } from '@/lib/i18n';
import { dispatchPushForEvent } from '@/lib/push/dispatch';

const Body = z.object({
  binToken: z.string().min(6),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100000).nullable(),
    timestamp: z.number().int().positive(),
  }),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const binId = await getBinIdByToken(body.binToken);
  if (!binId) return new NextResponse('Unknown bin token', { status: 404 });

  const supabase = getSupabaseAdmin();
  const locale = getLocaleFromHeaders(req.headers);

  const eventPayload = {
    location: body.location,
  };

  const { data: evt, error } = await supabase
    .from('bin_events')
    .insert({
      bin_id: binId,
      type: 'misplaced_location_shared',
      payload: eventPayload,
      public_locale: locale,
    })
    .select('id,bin_id,type,payload')
    .single();
  if (error) return new NextResponse(error.message, { status: 500 });

  await dispatchPushForEvent({
    binId,
    eventType: 'misplaced_location_shared',
    payload: eventPayload,
    url: `https://qrlabel.one/k/${body.binToken}`,
    locale,
  });

  return NextResponse.json({ ok: true, eventId: evt.id });
}

