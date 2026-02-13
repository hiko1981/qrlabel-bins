import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { randomToken } from '@/lib/random';

const Body = z.object({
  label: z.string().min(1),
  municipality: z.string().optional(),
  addressLine1: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  wasteStream: z.string().optional(),
});

export async function POST(req: Request) {
  const guard = requireAdmin(req);
  if (guard) return guard;

  const body = Body.parse(await req.json());
  const supabase = getSupabaseAdmin();

  const { data: bin, error: binErr } = await supabase
    .from('bins')
    .insert({
      label: body.label,
      municipality: body.municipality ?? null,
      address_line1: body.addressLine1 ?? null,
      postal_code: body.postalCode ?? null,
      city: body.city ?? null,
      country: body.country ?? null,
      waste_stream: body.wasteStream ?? null,
    })
    .select('id')
    .single();
  if (binErr) return new NextResponse(binErr.message, { status: 500 });

  const token = randomToken(12);
  const { error: tokenErr } = await supabase.from('bin_tokens').insert({ token, bin_id: bin.id });
  if (tokenErr) return new NextResponse(tokenErr.message, { status: 500 });

  return NextResponse.json({
    ok: true,
    binToken: token,
    binUrl: `/k/${token}`,
    canonicalScanUrl: `https://qrlabel.one/k/${token}`,
    qrLabelUrl: `https://qrlabel.eu/k/${token}`,
  });
}
