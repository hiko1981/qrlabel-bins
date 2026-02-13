import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSessionOrKey } from '@/lib/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBinIdByToken } from '@/lib/data';

const Body = z.object({
  binToken: z.string().min(6),
  role: z.enum(['owner', 'worker']),
  email: z.string().email().optional(),
  phone: z.string().min(3).optional(),
});

export async function POST(req: Request) {
  const guard = await requireAdminSessionOrKey(req);
  if (guard) return guard;

  const body = Body.parse(await req.json());
  if (!body.email && !body.phone) return new NextResponse('email or phone required', { status: 400 });

  const binId = await getBinIdByToken(body.binToken);
  if (!binId) return new NextResponse('Unknown bin token', { status: 404 });

  const supabase = getSupabaseAdmin();

  const email = body.email?.toLowerCase() ?? null;
  const phone = body.phone
    ? (() => {
        const digits = body.phone!.replace(/[^\d+]/g, '');
        const onlyDigits = digits.startsWith('+') ? digits.slice(1) : digits;
        if (onlyDigits.startsWith('45') && onlyDigits.length === 10) return onlyDigits.slice(2);
        return onlyDigits;
      })()
    : null;

  // Merge/update deterministically (avoid maybeSingle errors when duplicates exist).
  const emailRows = email
    ? (
        await supabase
          .from('bin_claim_contacts')
          .select('id,email,phone,activated_at,activated_user_id')
          .eq('bin_id', binId)
          .eq('role', body.role)
          .eq('email', email)
          .order('created_at', { ascending: true })
      ).data ?? []
    : [];

  const phoneRows = phone
    ? (
        await supabase
          .from('bin_claim_contacts')
          .select('id,email,phone,activated_at,activated_user_id')
          .eq('bin_id', binId)
          .eq('role', body.role)
          .eq('phone', phone)
          .order('created_at', { ascending: true })
      ).data ?? []
    : [];

  const primary = (emailRows[0] ?? phoneRows[0]) as
    | { id: string; email: string | null; phone: string | null; activated_at: string | null; activated_user_id: string | null }
    | undefined;

  // If both an email-row and phone-row exist (different ids), merge them into the email-row (or primary).
  if (primary) {
    const related = new Map<string, typeof primary>();
    for (const r of [...emailRows, ...phoneRows] as any[]) related.set(String(r.id), r);

    const hasActivationMismatch = (() => {
      const rows = Array.from(related.values());
      if (rows.length <= 1) return false;
      const key0 = `${rows[0]?.activated_at ?? ''}:${rows[0]?.activated_user_id ?? ''}`;
      return rows.some((r) => `${r.activated_at ?? ''}:${r.activated_user_id ?? ''}` !== key0);
    })();
    if (hasActivationMismatch) {
      return new NextResponse('Duplicate contacts with different activation state; cleanup required', { status: 409 });
    }

    const nextEmail = email ?? primary.email ?? null;
    const nextPhone = phone ?? primary.phone ?? null;

    // Delete other rows first to avoid unique index conflicts.
    const idsToDelete = Array.from(related.keys()).filter((id) => id !== primary.id);
    if (idsToDelete.length > 0) {
      const del = await supabase.from('bin_claim_contacts').delete().in('id', idsToDelete);
      if (del.error) return new NextResponse(del.error.message, { status: 500 });
    }

    const upd = await supabase
      .from('bin_claim_contacts')
      .update({ email: nextEmail, phone: nextPhone })
      .eq('id', primary.id);
    if (upd.error) return new NextResponse(upd.error.message, { status: 500 });
    return NextResponse.json({ ok: true, merged: related.size > 1 });
  }

  const { error: insErr } = await supabase.from('bin_claim_contacts').insert({
    bin_id: binId,
    role: body.role,
    email,
    phone,
  });
  if (insErr) return new NextResponse(insErr.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
