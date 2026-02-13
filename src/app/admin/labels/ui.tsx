'use client';

import { useMemo, useState } from 'react';
import { t } from '@/lib/uiText';

type BinRow = {
  binId: string;
  label: string;
  wasteStream: string | null;
  address: string | null;
  token: string;
};

export function AdminLabels() {
  const [adminKey, setAdminKey] = useState(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem('qrlabel_admin_key') ?? '' : '',
  );
  const [bins, setBins] = useState<BinRow[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const sampleToken = useMemo(() => 'JcX5YxtiBOc8aYmP', []);
  const locale = useMemo(() => (typeof navigator !== 'undefined' ? navigator.language : null), []);

  async function loadBins() {
    setError(null);
    const res = await fetch('/api/admin/bins', { headers: { 'x-admin-key': adminKey } });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { bins: BinRow[] };
    setBins(data.bins);
    if (!selectedToken && data.bins[0]?.token) setSelectedToken(data.bins[0].token);
  }

  function persistKey(v: string) {
    setAdminKey(v);
    window.localStorage.setItem('qrlabel_admin_key', v);
  }

  return (
    <div className="space-y-3">
      <label className="text-sm">
        {t(locale, 'adminKey')}
        <input
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          value={adminKey}
          onChange={(e) => persistKey(e.target.value)}
          placeholder="ADMIN_API_KEY"
        />
      </label>
      <button
        className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
        type="button"
        onClick={() => loadBins().catch((e) => setError(e instanceof Error ? e.message : String(e)))}
      >
        {t(locale, 'loadBins')}
      </button>

      {bins.length ? (
        <>
          <label className="text-sm">
            {t(locale, 'bin')}
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
            >
              {bins.map((b) => (
                <option key={b.token} value={b.token}>
                  {b.wasteStream ?? b.label} — {b.address ?? b.binId}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <a
              className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white"
              href={`/label/${encodeURIComponent(selectedToken)}`}
            >
              {t(locale, 'openLabel')}
            </a>
            <a className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" href={`/api/qr/png?token=${encodeURIComponent(selectedToken)}`}>
              PNG
            </a>
            <a className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" href={`/api/qr/pdf?token=${encodeURIComponent(selectedToken)}`}>
              PDF
            </a>
          </div>
        </>
      ) : null}

      <div className="pt-2">
        <a className="text-sm underline" href={`/label/${encodeURIComponent(sampleToken)}`}>
          {t(locale, 'generateSample')}
        </a>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
