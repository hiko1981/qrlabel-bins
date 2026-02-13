import 'server-only';

import { NextResponse } from 'next/server';
import { mustGetEnv } from '@/lib/env';

export function requireAdmin(req: Request) {
  const adminKey = mustGetEnv('ADMIN_API_KEY');
  const header = req.headers.get('x-admin-key');
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied = header ?? bearer;
  if (!supplied || supplied !== adminKey) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  return null;
}

