import Link from 'next/link';
import Image from 'next/image';
import { generateQrPngForToken, getQrMeta } from '@/lib/qr/qr';

const SAMPLE_TOKEN = 'JcX5YxtiBOc8aYmP';

export default async function SampleLabelsPage() {
  const token = SAMPLE_TOKEN;
  const meta = getQrMeta(token);
  const qr = await generateQrPngForToken(token);
  const qrDataUrl = `data:${qr.contentType};base64,${qr.body.toString('base64')}`;

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="text-xs text-neutral-500">Public sample</div>
      <h1 className="text-2xl font-semibold tracking-tight">Sample bin label</h1>
      <div className="mt-2 text-xs text-neutral-500 font-mono">{meta.encoded_url}</div>

      <div className="mt-4 rounded-2xl border bg-white p-6">
        <Image
          className="mx-auto block h-auto w-full max-w-[420px]"
          alt="Sample QR"
          src={qrDataUrl}
          width={420}
          height={420}
          unoptimized
          priority
        />
      </div>

      <div className="mt-4 grid gap-2">
        <a className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" href={`/api/qr/png?token=${token}`}>
          Download PNG
        </a>
        <a className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" href={`/api/qr/svg?token=${token}`}>
          Download SVG
        </a>
        <a className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" href={`/api/qr/pdf?token=${token}`}>
          Download PDF
        </a>
        <a className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" href={`/api/qr/bundle?token=${token}`}>
          Download ZIP bundle
        </a>
        <a
          className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
          href={`/label/${token}/print?autoprint=1&wmm=102&hmm=152`}
          target="_blank"
          rel="noreferrer"
        >
          Print (ZD421T)
        </a>
        <Link className="rounded-lg bg-black px-3 py-2 text-center text-sm font-medium text-white" href={`/label/${token}`}>
          Åbn label side
        </Link>
      </div>
    </main>
  );
}
