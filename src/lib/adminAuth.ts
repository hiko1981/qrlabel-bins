import 'server-only';

import { NextResponse } from 'next/server';
import { getOptionalEnv } from '@/lib/env';
import { getSession } from '@/lib/session';
import { isAdminUser } from '@/lib/adminSession';

export function requireAdmin(req: Request) {
  const adminKey = getOptionalEnv('ADMIN_API_KEY');
  if (!adminKey) {
    return new NextResponse('ADMIN_API_KEY not configured', { status: 500 });
  }
  const header = req.headers.get('x-admin-key');
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied = header ?? bearer;
  if (!supplied || supplied !== adminKey) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  return null;
}

export async function requireAdminSessionOrKey(req: Request) {
  const sess = await getSession();
  if (sess) {
    try {
      if (await isAdminUser(sess.userId)) return null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new NextResponse(msg, { status: 500 });
    }
  }
  // fallback to key
  return requireAdmin(req);
}
