import Link from 'next/link';
import { headers } from 'next/headers';
import Image from 'next/image';
import { getBinByToken } from '@/lib/data';
import { getQrMeta } from '@/lib/qr/qr';
import { getLocaleFromHeaders } from '@/lib/i18n';
import { t } from '@/lib/uiText';
import { generateQrPngForToken } from '@/lib/qr/qr';

export default async function LabelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const meta = getQrMeta(token);
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
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-neutral-500">{t(locale, 'printLabel')}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{bin?.wasteStream ?? bin?.label ?? 'Affald'}</h1>
          <div className="mt-1 text-sm text-neutral-600">{address || '—'}</div>
          <div className="mt-1 text-xs text-neutral-500 font-mono">{meta.encoded_url}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border bg-white p-6">
          <Image
            className="mx-auto block h-auto w-full max-w-[560px]"
            alt={`QR ${token}`}
            src={qrDataUrl}
            width={560}
            height={560}
            unoptimized
            priority
          />
          <div className="mt-4 text-center text-sm text-neutral-700">
            {t(locale, 'scanForInfo')} · <span className="font-mono">qrlabel.eu</span>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border bg-white p-4">
          <div className="text-sm font-medium">{t(locale, 'downloads')}</div>
          <a className="block rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" href={`/api/qr/png?token=${encodeURIComponent(token)}`}>
            {t(locale, 'downloadPng')}
          </a>
          <a className="block rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" href={`/api/qr/svg?token=${encodeURIComponent(token)}`}>
            {t(locale, 'downloadSvg')}
          </a>
          <a
            className="block rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
            href={`/api/qr/pdf?token=${encodeURIComponent(token)}`}
          >
            {t(locale, 'downloadPdf')}
          </a>
          <a
            className="block rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
            href={`/api/qr/pdf?token=${encodeURIComponent(token)}&count=6`}
          >
            {t(locale, 'downloadPdfSheet6')}
          </a>
          <a
            className="block rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
            href={`/api/qr/pdf?token=${encodeURIComponent(token)}&count=12`}
          >
            {t(locale, 'downloadPdfSheet12')}
          </a>

          <div className="pt-2 text-xs text-neutral-500">
            Token: <span className="font-mono">{token}</span>
          </div>
          <div className="text-xs text-neutral-500">
            QR label URL: <span className="font-mono">qrlabel.eu/k/{token}</span>
          </div>

          <div className="pt-2">
            <Link className="text-sm underline" href={`/k/${encodeURIComponent(token)}`}>
              Åbn bin side
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
