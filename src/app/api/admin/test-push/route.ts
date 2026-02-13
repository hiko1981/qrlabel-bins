import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminSessionOrKey } from '@/lib/adminAuth';
import { getSession } from '@/lib/session';
import { dispatchTestPushToPrincipal } from '@/lib/push/test';

const Body = z.object({
  principalId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const guard = await requireAdminSessionOrKey(req);
  if (guard) return guard;

  const body = Body.parse(await req.json().catch(() => ({})));
  const sess = await getSession();
  const principalId = body.principalId ?? sess?.userId;
  if (!principalId) return new NextResponse('principalId required', { status: 400 });

  await dispatchTestPushToPrincipal(principalId);
  return NextResponse.json({ ok: true });
}
