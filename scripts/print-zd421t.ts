import net from 'node:net';
import { z } from 'zod';
import sharp from 'sharp';
import { generateQrPngForToken } from '@/lib/qr/qr';
import { getBinByToken } from '@/lib/data';

const Args = z.object({
  ip: z.string().min(7),
  token: z.string().min(6),
  port: z.coerce.number().int().min(1).max(65535).default(9100),
  widthMm: z.coerce.number().positive().default(102),
  heightMm: z.coerce.number().positive().default(152),
  dpi: z.coerce.number().int().positive().default(203),
});

function mmToDots(mm: number, dpi: number) {
  return Math.round((mm / 25.4) * dpi);
}

function packBitsMsbFirst(bits: Uint8Array, width: number, height: number) {
  const bytesPerRow = Math.ceil(width / 8);
  const out = Buffer.alloc(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = bits[y * width + x] ? 1 : 0;
      if (!bit) continue;
      const byteIndex = y * bytesPerRow + (x >> 3);
      const mask = 0x80 >> (x & 7);
      out[byteIndex] |= mask;
    }
  }
  return { bytesPerRow, data: out };
}

async function buildLabelBitmap(token: string, width: number, height: number) {
  const qr = await generateQrPngForToken(token);
  const bin = await getBinByToken(token).catch(() => null);

  const title = (bin?.wasteStream ?? bin?.label ?? 'Affald').slice(0, 32);
  const address = [bin?.addressLine1, [bin?.postalCode, bin?.city].filter(Boolean).join(' '), bin?.country]
    .filter(Boolean)
    .join(', ')
    .slice(0, 64);

  const padding = Math.round(width * 0.06);
  const qrSize = Math.min(width - padding * 2, Math.round(height * 0.62));
  const qrLeft = Math.round((width - qrSize) / 2);
  const qrTop = Math.round(padding * 0.8);

  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="${width / 2}" y="${qrTop + qrSize + Math.round(height * 0.08)}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(height * 0.045)}" font-weight="700" fill="#0f172a">${escapeXml(
        title,
      )}</text>
    <text x="${width / 2}" y="${qrTop + qrSize + Math.round(height * 0.12)}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(height * 0.028)}" fill="#334155">${escapeXml(
        address || '—',
      )}</text>
    <text x="${width / 2}" y="${height - Math.round(height * 0.06)}" text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(height * 0.026)}" fill="#64748b">Scan for info · qrlabel.eu</text>
  </svg>`;

  const composed = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite([
      { input: qr.body, top: qrTop, left: qrLeft },
      { input: Buffer.from(svg), top: 0, left: 0 },
    ])
    .grayscale()
    .threshold(180) // 0/255
    .raw()
    .toBuffer({ resolveWithObject: true });

  const raw = composed.data; // 0 or 255 bytes
  const bits = new Uint8Array(width * height);
  for (let i = 0; i < raw.length; i++) {
    // In ZPL bitmap: 1 bits are black.
    bits[i] = raw[i] < 128 ? 1 : 0;
  }
  return bits;
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');
}

function toHex(buf: Buffer) {
  return buf.toString('hex').toUpperCase();
}

async function main() {
  const argv = Object.fromEntries(
    process.argv
      .slice(2)
      .map((a) => a.split('='))
      .map(([k, v]) => [k?.replace(/^--/, ''), v ?? '']),
  );

  const { ip, token, port, widthMm, heightMm, dpi } = Args.parse({
    ip: argv.ip,
    token: argv.token,
    port: argv.port,
    widthMm: argv.widthMm,
    heightMm: argv.heightMm,
    dpi: argv.dpi,
  });

  const width = mmToDots(widthMm, dpi);
  const height = mmToDots(heightMm, dpi);

  const bits = await buildLabelBitmap(token, width, height);
  const { bytesPerRow, data } = packBitsMsbFirst(bits, width, height);
  const totalBytes = data.length;

  const zpl = `^XA^PW${width}^LL${height}^FO0,0^GFA,${totalBytes},${totalBytes},${bytesPerRow},${toHex(
    data,
  )}^FS^XZ`;

  await sendToPrinter(ip, port, zpl);
  console.log(`OK printed token=${token} to ${ip}:${port} (${width}x${height} dots @ ${dpi}dpi)`);
}

function sendToPrinter(host: string, port: number, data: string) {
  return new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();
    socket.once('error', reject);
    socket.connect(port, host, () => {
      socket.write(data, 'ascii', () => {
        socket.end();
      });
    });
    socket.once('close', () => resolve());
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

