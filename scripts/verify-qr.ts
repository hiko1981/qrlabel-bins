import { generateQrPngForToken, getQrMeta } from '../src/lib/qr/qr';
import { PNG } from 'pngjs';
import jsqr from 'jsqr';

async function main() {
  const token = process.argv[2] ?? 'JcX5YxtiBOc8aYmP';
  const expected = getQrMeta(token).encoded_url;

  const png = await generateQrPngForToken(token);
  const parsed = PNG.sync.read(png.body);

  const data = new Uint8ClampedArray(parsed.data.buffer, parsed.data.byteOffset, parsed.data.byteLength);
  const decoded = jsqr(data, parsed.width, parsed.height);

  if (!decoded?.data) {
    throw new Error('Failed to decode QR');
  }
  if (decoded.data !== expected) {
    throw new Error(`Decoded mismatch: got=${decoded.data} expected=${expected}`);
  }

  console.log(`OK: ${token} -> ${decoded.data}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

