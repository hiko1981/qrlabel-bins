import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateQrPngForToken } from '@/lib/qr/qr';
import { bufferToReadableStream } from '@/lib/httpBody';

const Query = z.object({
  token: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { token } = Query.parse({ token: url.searchParams.get('token') });
  const asset = await generateQrPngForToken(token);

  const filename = `qrlabel-bin-${token}.png`;
  return new NextResponse(bufferToReadableStream(asset.body), {
    headers: {
      'content-type': asset.contentType,
      'cache-control': 'public, max-age=86400',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
}
