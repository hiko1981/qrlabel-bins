import Image from 'next/image';
import { headers } from 'next/headers';
import { getBinByToken } from '@/lib/data';
import { getLocaleFromHeaders } from '@/lib/i18n';
import { t } from '@/lib/uiText';
import { generateQrPngForToken } from '@/lib/qr/qr';

export default async function LabelPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const wmm = Number(typeof sp.wmm === 'string' ? sp.wmm : '102');
  const hmm = Number(typeof sp.hmm === 'string' ? sp.hmm : '152');
  const auto = (typeof sp.autoprint === 'string' ? sp.autoprint : '') === '1';

  let bin: Awaited<ReturnType<typeof getBinByToken>> = null;
  try {
    bin = await getBinByToken(token);
  } catch {}
  const locale = getLocaleFromHeaders(await headers());
  const qr = await generateQrPngForToken(token);
  const qrDataUrl = `data:${qr.contentType};base64,${qr.body.toString('base64')}`;

  const address = [bin?.addressLine1, [bin?.postalCode, bin?.city].filter(Boolean).join(' '), bin?.country]
    .filter(Boolean)
    .join(', ');

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Print label</title>
        <style>{`
          @page { size: ${wmm}mm ${hmm}mm; margin: 0; }
          html, body { height: 100%; }
          body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
          .sheet { width: ${wmm}mm; height: ${hmm}mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6mm; box-sizing: border-box; }
          .qr { width: min(80mm, 88%); height: auto; }
          .title { margin-top: 4mm; font-size: 14pt; font-weight: 700; text-align: center; }
          .addr { margin-top: 2mm; font-size: 9pt; text-align: center; color: #334155; }
          .hint { margin-top: 2mm; font-size: 8pt; text-align: center; color: #64748b; }
        `}</style>
        {auto ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.addEventListener('load', () => { setTimeout(() => window.print(), 250); });`,
            }}
          />
        ) : null}
      </head>
      <body>
        <div className="sheet">
          <Image className="qr" alt={`QR ${token}`} src={qrDataUrl} width={640} height={640} unoptimized priority />
          <div className="title">{bin?.wasteStream ?? bin?.label ?? t(locale, 'printLabel')}</div>
          <div className="addr">{address || '—'}</div>
          <div className="hint">
            {t(locale, 'scanForInfo')} · <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>qrlabel.eu</span>
          </div>
        </div>
      </body>
    </html>
  );
}

