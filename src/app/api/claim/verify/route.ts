import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sha256Base64Url } from '@/lib/crypto';
import { randomToken } from '@/lib/random';

const Body = z.object({
  verificationId: z.string().uuid().optional(),
  code: z.string().min(4).max(20),
  binToken: z.string().min(6),
});

export async function POST(req: Request) {
  const raw = Body.parse(await req.json());
  const body = { ...raw, code: raw.code.replace(/[^\d]/g, '') };
  if (body.code.length < 4) return new NextResponse('Invalid code', { status: 400 });
  const supabase = getSupabaseAdmin();

  let v:
    | {
        id: string;
        bin_id: string;
        role: string;
        contact_type: string;
        contact_value: string;
        code_hash: string;
        expires_at: string;
        consumed_at: string | null;
        attempts: number | null;
      }
    | null = null;

  if (body.verificationId) {
    const res = await supabase
      .from('contact_verifications')
      .select('id,bin_id,role,contact_type,contact_value,code_hash,expires_at,consumed_at,attempts')
      .eq('id', body.verificationId)
      .maybeSingle();
    if (res.error || !res.data) return new NextResponse('Invalid verification', { status: 400 });
    v = res.data as any;
  } else {
    const { data: tokenRow, error: tokenErr } = await supabase
      .from('bin_tokens')
      .select('bin_id')
      .eq('token', body.binToken)
      .maybeSingle();
    if (tokenErr || !tokenRow?.bin_id) return new NextResponse('Unknown bin token', { status: 404 });

    const { data: candidates, error: candErr } = await supabase
      .from('contact_verifications')
      .select('id,bin_id,role,contact_type,contact_value,code_hash,expires_at,consumed_at,attempts')
      .eq('bin_id', tokenRow.bin_id)
      .order('created_at', { ascending: false })
      .limit(25);
    if (candErr || !candidates) return new NextResponse('Invalid verification', { status: 400 });

    for (const row of candidates as any[]) {
      if (row.consumed_at) continue;
      if (new Date(row.expires_at) <= new Date()) continue;
      if ((row.attempts ?? 0) >= 5) continue;
      const expected = sha256Base64Url(
        `${body.code}:${row.bin_id}:${row.role}:${row.contact_type}:${row.contact_value}`,
      );
      if (expected === row.code_hash) {
        v = row;
        break;
      }
    }
    if (!v) return new NextResponse('Invalid code', { status: 400 });
  }
  if (!v) return new NextResponse('Invalid verification', { status: 400 });

  if (v.consumed_at) return new NextResponse('Already used', { status: 400 });
  if (new Date(v.expires_at) <= new Date()) return new NextResponse('Expired', { status: 400 });
  if ((v.attempts ?? 0) >= 5) return new NextResponse('Too many attempts', { status: 429 });

  const expected = sha256Base64Url(`${body.code}:${v.bin_id}:${v.role}:${v.contact_type}:${v.contact_value}`);
  if (expected !== v.code_hash) {
    await supabase.from('contact_verifications').update({ attempts: (v.attempts ?? 0) + 1 }).eq('id', v.id);
    return new NextResponse('Invalid code', { status: 400 });
  }

  // Create principal + membership + claim token (passkey registration)
  const { data: user, error: userErr } = await supabase.from('users').insert({}).select('id').single();
  if (userErr) return new NextResponse(userErr.message, { status: 500 });

  const { error: memberErr } = await supabase.from('bin_members').insert({
    bin_id: v.bin_id,
    user_id: user.id,
    role: v.role,
  });
  if (memberErr) return new NextResponse(memberErr.message, { status: 500 });

  const claimToken = randomToken(24);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('bin_tokens')
    .select('token')
    .eq('token', body.binToken)
    .maybeSingle();
  if (tokenErr || !tokenRow) return new NextResponse('Unknown bin token', { status: 404 });

  const claimIns = await supabase.from('claim_tokens').insert({
    token: claimToken,
    user_id: user.id,
    bin_token: body.binToken,
    role: v.role,
    contact_type: v.contact_type,
    contact_value: v.contact_value,
    expires_at: expiresAt,
  });
  if (claimIns.error) return new NextResponse(claimIns.error.message, { status: 500 });

  await supabase
    .from('contact_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', v.id);

  return NextResponse.json({ ok: true, claimToken, claimUrl: `/claim/${claimToken}` });
}
