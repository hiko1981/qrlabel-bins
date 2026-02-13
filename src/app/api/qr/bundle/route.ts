import { NextResponse } from 'next/server';
import { z } from 'zod';
import JSZip from 'jszip';
import { generateQrPngForToken, generateQrSvgForToken } from '@/lib/qr/qr';
import { bufferToReadableStream } from '@/lib/httpBody';
import { generateLabelPdfBytes } from '@/lib/qr/pdf';

const Query = z.object({
  token: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { token } = Query.parse({ token: url.searchParams.get('token') });

  const [png, svg, pdf] = await Promise.all([
    generateQrPngForToken(token),
    generateQrSvgForToken(token),
    generateLabelPdfBytes({ token }),
  ]);

  const zip = new JSZip();
  zip.file(`qrlabel-bin-${token}.png`, png.body);
  zip.file(`qrlabel-bin-${token}.svg`, svg.body);
  zip.file(`qrlabel-bin-${token}.pdf`, pdf);

  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });

  return new NextResponse(bufferToReadableStream(out), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="qrlabel-bin-${token}.zip"`,
      'cache-control': 'public, max-age=86400',
    },
  });
}
