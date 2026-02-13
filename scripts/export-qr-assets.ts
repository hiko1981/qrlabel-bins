import fs from 'node:fs/promises';
import path from 'node:path';
import { generateQrPngForToken, generateQrSvgForToken, getQrMeta } from '@/lib/qr/qr';

async function main() {
  const token = process.argv[2] ?? 'JcX5YxtiBOc8aYmP';
  const outDir = path.join(process.cwd(), 'out');
  await fs.mkdir(outDir, { recursive: true });

  const [png, svg] = await Promise.all([generateQrPngForToken(token), generateQrSvgForToken(token)]);

  await Promise.all([
    fs.writeFile(path.join(outDir, `qrlabel-bin-${token}.png`), png.body),
    fs.writeFile(path.join(outDir, `qrlabel-bin-${token}.svg`), svg.body),
    fs.writeFile(path.join(outDir, `qrlabel-bin-${token}.meta.json`), JSON.stringify(getQrMeta(token), null, 2)),
  ]);

  console.log(`Wrote assets to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
