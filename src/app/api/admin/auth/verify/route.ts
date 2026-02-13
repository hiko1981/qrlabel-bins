import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sha256Base64Url } from '@/lib/crypto';
import { setSession } from '@/lib/session';

const Body = z.object({
  verificationId: z.string().uuid(),
  code: z.string().min(4).max(10),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json().catch(() => ({})));
  const supabase = getSupabaseAdmin();

  const { data: v, error: vErr } = await supabase
    .from('admin_verifications')
    .select('id,contact_type,contact_value,code_hash,expires_at,consumed_at,attempts')
    .eq('id', body.verificationId)
    .maybeSingle();
  if (vErr || !v) return new NextResponse('Invalid verification', { status: 400 });
  if (v.consumed_at) return new NextResponse('Already used', { status: 400 });
  if (new Date(v.expires_at) <= new Date()) return new NextResponse('Expired', { status: 400 });
  if ((v.attempts ?? 0) >= 5) return new NextResponse('Too many attempts', { status: 429 });

  const expected = sha256Base64Url(`admin:${body.code}:${v.contact_type}:${v.contact_value}`);
  if (expected !== v.code_hash) {
    await supabase.from('admin_verifications').update({ attempts: (v.attempts ?? 0) + 1 }).eq('id', v.id);
    return new NextResponse('Invalid code', { status: 400 });
  }

  const { data: existingContact, error: cErr } = await supabase
    .from('admin_contacts')
    .select('user_id')
    .eq('contact_type', v.contact_type)
    .eq('contact_value', v.contact_value)
    .maybeSingle();
  if (cErr) return new NextResponse(cErr.message, { status: 500 });

  let userId = existingContact?.user_id ?? null;

  if (!userId) {
    const { data: user, error: userErr } = await supabase.from('users').insert({}).select('id').single();
    if (userErr) return new NextResponse(userErr.message, { status: 500 });
    userId = user.id;

    const contactIns = await supabase.from('admin_contacts').insert({
      contact_type: v.contact_type,
      contact_value: v.contact_value,
      user_id: userId,
    });
    if (contactIns.error) return new NextResponse(contactIns.error.message, { status: 500 });
  }

  const memberIns = await supabase.from('admin_members').insert({ user_id: userId });
  if (memberIns.error && memberIns.error.code !== '23505') {
    return new NextResponse(memberIns.error.message, { status: 500 });
  }

  await supabase.from('admin_verifications').update({ consumed_at: new Date().toISOString() }).eq('id', v.id);

  await setSession(userId);
  return NextResponse.json({ ok: true, userId, redirectTo: '/admin/labels' });
}

