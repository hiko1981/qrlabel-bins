import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getQrMeta } from '@/lib/qr/qr';

const Query = z.object({
  token: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { token } = Query.parse({ token: url.searchParams.get('token') });
  return NextResponse.json(getQrMeta(token));
}

