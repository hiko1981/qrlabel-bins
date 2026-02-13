import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { randomToken } from '@/lib/random';

const Body = z.object({
  binToken: z.string().min(6),
  role: z.enum(['owner', 'worker']),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export async function POST(req: Request) {
  const guard = requireAdmin(req);
  if (guard) return guard;

  const body = Body.parse(await req.json());
  const supabase = getSupabaseAdmin();

  const { data: tokenRow } = await supabase
    .from('bin_tokens')
    .select('bin_id')
    .eq('token', body.binToken)
    .maybeSingle();
  if (!tokenRow?.bin_id) return new NextResponse('Unknown bin token', { status: 404 });

  const { data: user, error: userErr } = await supabase.from('users').insert({}).select('id').single();
  if (userErr) return new NextResponse(userErr.message, { status: 500 });

  const memberIns = await supabase.from('bin_members').insert({
    bin_id: tokenRow.bin_id,
    user_id: user.id,
    role: body.role,
  });
  if (memberIns.error) return new NextResponse(memberIns.error.message, { status: 500 });

  const claimToken = randomToken(24);
  const expiresInDays = body.expiresInDays ?? 7;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const claimIns = await supabase.from('claim_tokens').insert({
    token: claimToken,
    user_id: user.id,
    bin_token: body.binToken,
    role: body.role,
    expires_at: expiresAt,
  });
  if (claimIns.error) return new NextResponse(claimIns.error.message, { status: 500 });

  return NextResponse.json({
    ok: true,
    role: body.role,
    claimToken,
    claimUrl: `/claim/${claimToken}`,
    claimUrlAbsolute: `https://www.qrlabel.eu/claim/${claimToken}`,
  });
}
