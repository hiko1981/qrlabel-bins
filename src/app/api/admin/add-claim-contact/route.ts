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
  const { error } = await supabase.from('bin_claim_contacts').insert({
    bin_id: binId,
    role: body.role,
    email: body.email?.toLowerCase() ?? null,
    phone: body.phone
      ? (() => {
          const digits = body.phone!.replace(/[^\d+]/g, '');
          const onlyDigits = digits.startsWith('+') ? digits.slice(1) : digits;
          if (onlyDigits.startsWith('45') && onlyDigits.length === 10) return onlyDigits.slice(2);
          return onlyDigits;
        })()
      : null,
  });
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
