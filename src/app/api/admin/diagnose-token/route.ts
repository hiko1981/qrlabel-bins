import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSessionOrKey } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Query = z.object({
  token: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

export async function GET(req: Request) {
  const guard = await requireAdminSessionOrKey(req);
  if (guard) return guard;

  const url = new URL(req.url);
  const { token } = Query.parse({ token: url.searchParams.get('token') });

  try {
    const supabase = getSupabaseAdmin();

    const tokenRes = await supabase.from('bin_tokens').select('token, bin_id').eq('token', token).maybeSingle();
    const binRes = tokenRes.data?.bin_id
      ? await supabase.from('bins').select('id,label,municipality').eq('id', tokenRes.data.bin_id).maybeSingle()
      : { data: null, error: null };

    return NextResponse.json({
      ok: true,
      token,
      tokenRow: tokenRes.data ?? null,
      tokenError: tokenRes.error ? { message: tokenRes.error.message, code: tokenRes.error.code } : null,
      binRow: binRes.data ?? null,
      binError: binRes.error ? { message: binRes.error.message, code: binRes.error.code } : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, token, error: message }, { status: 500 });
  }
}
