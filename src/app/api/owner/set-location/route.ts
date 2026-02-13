import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBinIdByToken } from '@/lib/data';

const Body = z.object({
  binToken: z.string().min(6),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100000).optional(),
  mapStyle: z.enum(['map', 'satellite']).optional(),
});

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const body = Body.parse(await req.json());
  const binId = await getBinIdByToken(body.binToken);
  if (!binId) return new NextResponse('Unknown bin token', { status: 404 });

  const supabase = getSupabaseAdmin();

  const { data: member, error: memErr } = await supabase
    .from('bin_members')
    .select('id')
    .eq('bin_id', binId)
    .eq('user_id', sess.userId)
    .eq('role', 'owner')
    .maybeSingle();
  if (memErr) return new NextResponse(memErr.message, { status: 500 });
  if (!member) return new NextResponse('Forbidden', { status: 403 });

  const ins = await supabase.from('bin_events').insert({
    bin_id: binId,
    type: 'owner_location_set',
    payload: {
      location: {
        lat: body.lat,
        lng: body.lng,
        accuracy: body.accuracy ?? null,
      },
      mapStyle: body.mapStyle ?? 'map',
    },
    created_by_principal_id: sess.userId,
  });
  if (ins.error) return new NextResponse(ins.error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}

