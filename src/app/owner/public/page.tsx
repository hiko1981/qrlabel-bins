import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { getOwnerBins } from '@/lib/data';

export default async function OwnerPublicSelectPage() {
  const sess = await getSession();
  if (!sess) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Public visning</h1>
        <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-neutral-700">Du er ikke logget ind.</div>
      </main>
    );
  }

  const bins = await getOwnerBins(sess.userId);
  const jar = await cookies();
  const last = jar.get('qrlabel_last_bin_token')?.value ?? '';

  const match = bins.find((b) => b.locatorToken && b.locatorToken === last);
  if (match?.locatorToken) redirect(`/owner/public/${encodeURIComponent(match.locatorToken)}`);
  if (bins.length === 1 && bins[0]?.locatorToken) redirect(`/owner/public/${encodeURIComponent(bins[0].locatorToken)}`);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Public visning</h1>
        <Link className="text-sm underline" href="/owner">
          Tilbage
        </Link>
      </div>

      <div className="mt-4 grid gap-2">
        {bins.map((b) =>
          b.locatorToken ? (
            <Link
              key={b.id}
              className="rounded-xl border bg-white px-4 py-4 text-sm font-medium hover:bg-neutral-50"
              href={`/owner/public/${encodeURIComponent(b.locatorToken)}`}
            >
              {b.label}
            </Link>
          ) : null,
        )}
      </div>
    </main>
  );
}

