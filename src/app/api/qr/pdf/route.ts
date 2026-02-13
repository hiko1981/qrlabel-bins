import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bufferToReadableStream } from '@/lib/httpBody';
import { generateLabelPdfBytes } from '@/lib/qr/pdf';

const Query = z.object({
  token: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
  count: z.coerce.number().int().min(1).max(12).optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { token, count } = Query.parse({
    token: url.searchParams.get('token'),
    count: url.searchParams.get('count') ?? undefined,
  });

  const body = await generateLabelPdfBytes({ token, count });
  const filename = count ? `qrlabel-bin-${token}-sheet-${count}.pdf` : `qrlabel-bin-${token}.pdf`;
  return new NextResponse(bufferToReadableStream(body), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'public, max-age=86400',
    },
  });
}
