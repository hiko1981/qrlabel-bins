type Key =
  | 'printLabel'
  | 'downloads'
  | 'downloadPng'
  | 'downloadSvg'
  | 'downloadPdf'
  | 'downloadPdfSheet6'
  | 'downloadPdfSheet12'
  | 'scanForInfo'
  | 'ownerDashboard'
  | 'admin'
  | 'labels'
  | 'adminKey'
  | 'loadBins'
  | 'bin'
  | 'openLabel'
  | 'generateSample';

const da: Record<Key, string> = {
  printLabel: 'Print label',
  downloads: 'Downloads',
  downloadPng: 'Download PNG (1024×1024)',
  downloadSvg: 'Download SVG',
  downloadPdf: 'Download PDF (A4)',
  downloadPdfSheet6: 'Download PDF sheet (6)',
  downloadPdfSheet12: 'Download PDF sheet (12)',
  scanForInfo: 'Scan for info',
  ownerDashboard: 'Owner dashboard',
  admin: 'Admin',
  labels: 'Labels',
  adminKey: 'Admin key',
  loadBins: 'Load bins',
  bin: 'Bin',
  openLabel: 'Open label',
  generateSample: 'Generate sample (Ringstedgade 146 / Madaffald)',
};

const en: Record<Key, string> = {
  printLabel: 'Print label',
  downloads: 'Downloads',
  downloadPng: 'Download PNG (1024×1024)',
  downloadSvg: 'Download SVG',
  downloadPdf: 'Download PDF (A4)',
  downloadPdfSheet6: 'Download PDF sheet (6)',
  downloadPdfSheet12: 'Download PDF sheet (12)',
  scanForInfo: 'Scan for info',
  ownerDashboard: 'Owner dashboard',
  admin: 'Admin',
  labels: 'Labels',
  adminKey: 'Admin key',
  loadBins: 'Load bins',
  bin: 'Bin',
  openLabel: 'Open label',
  generateSample: 'Generate sample (Ringstedgade 146 / Madaffald)',
};

export function t(locale: string | null | undefined, key: Key) {
  const loc = (locale ?? '').toLowerCase();
  const dict = loc.startsWith('da') ? da : en;
  return dict[key];
}

