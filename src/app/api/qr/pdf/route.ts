import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { generateQrPngForToken } from '@/lib/qr/qr';
import { getBinByToken } from '@/lib/data';
import { bufferToReadableStream } from '@/lib/httpBody';

const Query = z.object({
  token: z.string().min(6).max(64).regex(/^[A-Za-z0-9_-]+$/),
  count: z.coerce.number().int().min(1).max(12).optional(),
});

function a4() {
  return { width: 595.28, height: 841.89 }; // points
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { token, count } = Query.parse({
    token: url.searchParams.get('token'),
    count: url.searchParams.get('count') ?? undefined,
  });

  const bin = await getBinByToken(token);
  const qr = await generateQrPngForToken(token);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const { width, height } = a4();
  const sheetCount = count ?? 1;

  if (sheetCount === 1) {
    const page = pdf.addPage([width, height]);
    const png = await pdf.embedPng(qr.body);

    const qrSize = 420;
    const qrX = (width - qrSize) / 2;
    const qrY = height - qrSize - 110;

    page.drawImage(png, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    const title = bin?.wasteStream || bin?.label || 'Affald';
    page.drawText(title, { x: 48, y: 82, size: 22, font, color: rgb(0.06, 0.09, 0.16) });

    const addr = [bin?.addressLine1, [bin?.postalCode, bin?.city].filter(Boolean).join(' '), bin?.country]
      .filter(Boolean)
      .join(', ');
    if (addr) {
      page.drawText(addr, { x: 48, y: 54, size: 12, font, color: rgb(0.25, 0.25, 0.28) });
    }

    page.drawText('Scan for info · qrlabel.one', {
      x: 48,
      y: 32,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.38),
    });
  } else {
    const cols = sheetCount <= 6 ? 2 : 3;
    const rows = sheetCount <= 6 ? 3 : 4;
    const page = pdf.addPage([width, height]);
    const png = await pdf.embedPng(qr.body);

    const margin = 24;
    const cellW = (width - margin * 2) / cols;
    const cellH = (height - margin * 2) / rows;
    const qrSize = Math.min(cellW, cellH) * 0.72;

    for (let i = 0; i < sheetCount; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x0 = margin + c * cellW;
      const y0 = height - margin - (r + 1) * cellH;

      const qrX = x0 + (cellW - qrSize) / 2;
      const qrY = y0 + (cellH - qrSize) / 2 + 12;
      page.drawImage(png, { x: qrX, y: qrY, width: qrSize, height: qrSize });

      const label = (bin?.wasteStream || bin?.label || 'Affald') as string;
      page.drawText(label, { x: x0 + 8, y: y0 + 10, size: 10, font, color: rgb(0.06, 0.09, 0.16) });
    }
  }

  const out = await pdf.save();
  const body = Buffer.from(out);
  return new NextResponse(bufferToReadableStream(body), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename=\"qrlabel-${token}.pdf\"`,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
