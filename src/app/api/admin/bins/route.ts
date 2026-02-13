import { NextResponse } from 'next/server';
import { requireAdminSessionOrKey } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  const guard = await requireAdminSessionOrKey(req);
  if (guard) return guard;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('bin_tokens')
    .select('token, bin:bins(id,label,waste_stream,address_line1,postal_code,city,country)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return new NextResponse(error.message, { status: 500 });

  type BinShape = {
    id: string;
    label: string;
    waste_stream: string | null;
    address_line1: string | null;
    postal_code: string | null;
    city: string | null;
    country: string | null;
  };
  type Row = { token: string; bin: BinShape | BinShape[] | null };
  const rows = (data ?? []) as unknown as Row[];

  const bins = rows.map((row) => {
    const bin = row.bin ? (Array.isArray(row.bin) ? row.bin[0] : row.bin) : null;
    const address = bin
      ? [bin.address_line1, [bin.postal_code, bin.city].filter(Boolean).join(' '), bin.country].filter(Boolean).join(', ')
      : null;
    return {
      binId: bin?.id ?? null,
      label: bin?.label ?? '',
      wasteStream: bin?.waste_stream ?? null,
      address,
      token: row.token,
    };
  });

  return NextResponse.json({ bins });
}
