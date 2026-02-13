import net from 'node:net';
import { z } from 'zod';
import sharp from 'sharp';
import { generateQrPngForToken } from '@/lib/qr/qr';

const Args = z.object({
  ip: z.string().min(7),
  token: z.string().min(6),
  port: z.coerce.number().int().min(1).max(65535).default(9100),
  widthMm: z.coerce.number().positive().default(102),
  heightMm: z.coerce.number().positive().default(152),
  dpi: z.coerce.number().int().positive().default(203),
  title: z.string().optional(),
  address: z.string().optional(),
  debugPng: z.string().optional(),
  dryRun: z.coerce.boolean().optional(),
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
  const title = (process.env.QRLABEL_PRINT_TITLE ?? 'Affald').slice(0, 32);
  const address = (process.env.QRLABEL_PRINT_ADDRESS ?? '—').slice(0, 64);

  const padding = Math.round(width * 0.06);
  const qrSize = Math.min(width - padding * 2, Math.round(height * 0.62));
  const qrLeft = Math.round((width - qrSize) / 2);
  const qrTop = Math.round(padding * 0.8);

  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
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

  const qrResized = await sharp(qr.body).resize(qrSize, qrSize, { fit: 'contain' }).png().toBuffer();

  const composed = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#ffffff',
    },
  })
    .composite([
      { input: Buffer.from(svg), top: 0, left: 0 },
      { input: qrResized, top: qrTop, left: qrLeft },
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
    title: argv.title,
    address: argv.address,
    debugPng: argv.debugPng,
    dryRun: argv.dryRun,
  });

  if (argv.title) process.env.QRLABEL_PRINT_TITLE = String(argv.title);
  if (argv.address) process.env.QRLABEL_PRINT_ADDRESS = String(argv.address);

  const width = mmToDots(widthMm, dpi);
  const height = mmToDots(heightMm, dpi);

  const bits = await buildLabelBitmap(token, width, height);
  const { bytesPerRow, data } = packBitsMsbFirst(bits, width, height);
  const totalBytes = data.length;

  const zpl = `^XA^PW${width}^LL${height}^FO0,0^GFA,${totalBytes},${totalBytes},${bytesPerRow},${toHex(
    data,
  )}^FS^XZ`;

  if (argv.debugPng) {
    // Recreate a preview image (black/white) from the packed bits
    const bytesPerRowLocal = bytesPerRow;
    const preview = Buffer.alloc(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byteIndex = y * bytesPerRowLocal + (x >> 3);
        const mask = 0x80 >> (x & 7);
        const isBlack = (data[byteIndex]! & mask) !== 0;
        preview[y * width + x] = isBlack ? 0 : 255;
      }
    }
    await sharp(preview, { raw: { width, height, channels: 1 } }).png().toFile(String(argv.debugPng));
    console.log(`Wrote preview PNG: ${argv.debugPng}`);
  }

  if (argv.dryRun) {
    console.log(`Dry-run: would print token=${token} to ${ip}:${port} (${width}x${height} dots @ ${dpi}dpi)`);
    return;
  }

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
