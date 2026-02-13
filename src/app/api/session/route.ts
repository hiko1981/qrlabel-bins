import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getRolesForUserInBinToken } from '@/lib/data';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const binToken = z.string().optional().parse(url.searchParams.get('binToken') ?? undefined);

  const sess = await getSession();
  if (!sess) return NextResponse.json({ authed: false });
  const roles = binToken ? await getRolesForUserInBinToken(sess.userId, binToken) : [];
  return NextResponse.json({ authed: true, user: { id: sess.userId, roles } });
}

