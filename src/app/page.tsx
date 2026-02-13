import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="text-xs text-neutral-500">Nyt produkt</div>
      <h1 className="text-3xl font-semibold tracking-tight">QRLABEL Bins</h1>

      <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-neutral-700">
        Alle scanninger går til <span className="font-mono">qrlabel.one/k/&lt;token&gt;</span>.
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/k/demo" className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50">
          Åbn eksempel: /k/demo
        </Link>
      </div>
    </main>
  );
}
