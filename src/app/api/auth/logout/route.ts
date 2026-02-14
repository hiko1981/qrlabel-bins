import { NextResponse } from 'next/server';
import { clearSessionOnResponse } from '@/lib/session';

export async function POST(req: Request) {
  const res = NextResponse.json({ ok: true });
  clearSessionOnResponse(res, req);
  return res;
}
