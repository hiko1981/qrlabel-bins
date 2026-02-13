import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { getFromMemory, setInMemory } from '@/lib/qr/cache';

const SIZE = 1024;
const MARGIN = 4;
const LOGO_RATIO = 0.2;
const PLATE_RATIO = 0.28;

function tokenToUrl(token: string) {
  return `https://qrx.dk/k/${token}`;
}

function tmpPath(token: string, ext: 'png' | 'svg') {
  return path.join(os.tmpdir(), `qrlabel_qr_${token}.${ext}`);
}

async function readIfExists(filePath: string) {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

async function writeBestEffort(filePath: string, data: Buffer) {
  try {
    await fs.writeFile(filePath, data);
  } catch {}
}

async function getLogoPng() {
  const logoPath = path.join(process.cwd(), 'public', 'brand', 'avira-mark.png');
  return fs.readFile(logoPath);
}

function plateSvg(size: number) {
  const plate = Math.round(size * PLATE_RATIO);
  const x = Math.round((size - plate) / 2);
  const y = Math.round((size - plate) / 2);
  const rx = Math.round(plate * 0.18);
  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg"><rect x="${x}" y="${y}" width="${plate}" height="${plate}" rx="${rx}" fill="#ffffff"/></svg>`,
  );
}

export async function generateQrPngForToken(token: string) {
  const cacheKey = `png:${token}`;
  const cached = getFromMemory(cacheKey);
  if (cached) return cached;

  const existing = await readIfExists(tmpPath(token, 'png'));
  if (existing) {
    const asset = { contentType: 'image/png', body: existing };
    setInMemory(cacheKey, asset);
    return asset;
  }

  const url = tokenToUrl(token);
  const base = await QRCode.toBuffer(url, {
    type: 'png',
    width: SIZE,
    margin: MARGIN,
    errorCorrectionLevel: 'H',
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const logoSize = Math.round(SIZE * LOGO_RATIO);
  const logoLeft = Math.round((SIZE - logoSize) / 2);
  const logoTop = Math.round((SIZE - logoSize) / 2);

  const [logoPng, plated] = await Promise.all([
    getLogoPng().then((buf) => sharp(buf).resize(logoSize, logoSize, { fit: 'contain' }).png().toBuffer()),
    Promise.resolve(plateSvg(SIZE)),
  ]);

  const out = await sharp(base)
    .composite([
      { input: plated, top: 0, left: 0 },
      { input: logoPng, top: logoTop, left: logoLeft },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeBestEffort(tmpPath(token, 'png'), out);

  const asset = { contentType: 'image/png', body: out };
  setInMemory(cacheKey, asset);
  return asset;
}

export async function generateQrSvgForToken(token: string) {
  const cacheKey = `svg:${token}`;
  const cached = getFromMemory(cacheKey);
  if (cached) return cached;

  const existing = await readIfExists(tmpPath(token, 'svg'));
  if (existing) {
    const asset = { contentType: 'image/svg+xml; charset=utf-8', body: existing };
    setInMemory(cacheKey, asset);
    return asset;
  }

  const url = tokenToUrl(token);
  const baseSvg = await QRCode.toString(url, {
    type: 'svg',
    margin: MARGIN,
    errorCorrectionLevel: 'H',
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const plate = Math.round(SIZE * PLATE_RATIO);
  const x = Math.round((SIZE - plate) / 2);
  const y = Math.round((SIZE - plate) / 2);
  const rx = Math.round(plate * 0.18);
  const logoSize = Math.round(SIZE * LOGO_RATIO);
  const logoX = Math.round((SIZE - logoSize) / 2);
  const logoY = Math.round((SIZE - logoSize) / 2);

  const logoBase64 = (await getLogoPng()).toString('base64');

  // Normalize to a fixed size for printing
  const normalized = baseSvg
    .replace(/width=\"[^\"]+\"/i, `width="${SIZE}"`)
    .replace(/height=\"[^\"]+\"/i, `height="${SIZE}"`)
    .replace(
      /<\/svg>\s*$/i,
      `<rect x="${x}" y="${y}" width="${plate}" height="${plate}" rx="${rx}" fill="#ffffff"/><image href="data:image/png;base64,${logoBase64}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/></svg>`,
    );

  const out = Buffer.from(normalized, 'utf8');
  await writeBestEffort(tmpPath(token, 'svg'), out);

  const asset = { contentType: 'image/svg+xml; charset=utf-8', body: out };
  setInMemory(cacheKey, asset);
  return asset;
}

export function getQrMeta(token: string) {
  return {
    token,
    encoded_url: tokenToUrl(token),
    canonical_url: `https://qrlabel.one/k/${token}`,
  };
}
