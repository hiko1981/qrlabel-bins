import Link from 'next/link';
import { getSession } from '@/lib/session';
import { getOwnerBins } from '@/lib/data';

export default async function OwnerBinsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sess = await getSession();
  if (!sess) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Mine affaldsspande</h1>
        <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-neutral-700">Du er ikke logget ind.</div>
      </main>
    );
  }

  const sp = await searchParams;
  const mode = typeof sp.mode === 'string' ? sp.mode : null;
  const ok = typeof sp.ok === 'string' ? sp.ok : null;

  const bins = await getOwnerBins(sess.userId);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Mine affaldsspande</h1>
        <Link className="text-sm underline" href="/owner">
          Tilbage
        </Link>
      </div>

      {ok ? (
        <div className="mt-4 rounded-xl border bg-white p-3 text-sm text-neutral-700">Affaldsspand fjernet.</div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {bins.length === 0 ? (
          <div className="rounded-xl border bg-white p-4 text-sm text-neutral-700">Ingen spande endnu.</div>
        ) : null}

        {bins.map((b) => (
          <div key={b.id} className="rounded-xl border bg-white p-4">
            <div className="text-sm font-medium">{b.label}</div>
            {b.municipality ? <div className="mt-1 text-xs text-neutral-500">{b.municipality}</div> : null}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              {b.locatorToken ? (
                <>
                  <a className="underline" href={`/k/${encodeURIComponent(b.locatorToken)}`}>
                    Åbn
                  </a>
                  <a className="underline" href={`/owner/public/${encodeURIComponent(b.locatorToken)}`}>
                    Public
                  </a>
                  <a className="underline" href={`/owner/location/${encodeURIComponent(b.locatorToken)}`}>
                    Placering
                  </a>
                </>
              ) : (
                <div className="text-xs text-neutral-500">Ingen token knyttet.</div>
              )}
            </div>

            {mode === 'remove' && b.locatorToken ? (
              <div className="mt-4">
                <form action="/api/owner/unlink-bin" method="post">
                  <input type="hidden" name="binToken" value={b.locatorToken} />
                  <button className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" type="submit">
                    Fjern affaldsspand
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}

