'use client';

import { useMemo, useState } from 'react';
import { t } from '@/lib/uiText';
import Link from 'next/link';

type BinRow = {
  binId: string;
  label: string;
  wasteStream: string | null;
  address: string | null;
  token: string;
};

export function AdminLabels() {
  const [bins, setBins] = useState<BinRow[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newBin, setNewBin] = useState({
    label: '',
    municipality: '',
    addressLine1: '',
    postalCode: '',
    city: '',
    country: 'Danmark',
    wasteStream: '',
  });
  const [contact, setContact] = useState<{ role: 'owner' | 'worker'; email: string; phone: string }>({
    role: 'owner',
    email: '',
    phone: '',
  });
  const sampleToken = useMemo(() => 'JcX5YxtiBOc8aYmP', []);
  const locale = useMemo(() => (typeof navigator !== 'undefined' ? navigator.language : null), []);

  async function loadBins() {
    setError(null);
    setInfo(null);
    const res = await fetch('/api/admin/bins');
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { bins: BinRow[] };
    setBins(data.bins);
    if (!selectedToken && data.bins[0]?.token) setSelectedToken(data.bins[0].token);
  }

  async function createBin() {
    setError(null);
    setInfo(null);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/create-bin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: newBin.label,
          municipality: newBin.municipality || undefined,
          addressLine1: newBin.addressLine1 || undefined,
          postalCode: newBin.postalCode || undefined,
          city: newBin.city || undefined,
          country: newBin.country || undefined,
          wasteStream: newBin.wasteStream || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { binToken: string; qrLabelUrl: string };
      setInfo(`Oprettet: ${data.binToken}`);
      setSelectedToken(data.binToken);
      await loadBins();
    } finally {
      setCreating(false);
    }
  }

  async function addClaimContact() {
    setError(null);
    setInfo(null);
    if (!selectedToken) throw new Error('Vælg en bin først');
    const res = await fetch('/api/admin/add-claim-contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        binToken: selectedToken,
        role: contact.role,
        email: contact.email ? contact.email : undefined,
        phone: contact.phone ? contact.phone : undefined,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    setInfo('Kontakt tilføjet');
    setContact({ ...contact, email: '', phone: '' });
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-neutral-500">
        <Link className="underline" href="/admin/login">
          Log ind som admin
        </Link>
      </div>
      <button
        className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
        type="button"
        onClick={() => loadBins().catch((e) => setError(e instanceof Error ? e.message : String(e)))}
      >
        {t(locale, 'loadBins')}
      </button>

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="text-sm font-medium">Opret bin</div>
        <div className="grid gap-2">
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={newBin.label}
            onChange={(e) => setNewBin((s) => ({ ...s, label: e.target.value }))}
            placeholder="Label (fx Ringstedgade 146)"
          />
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={newBin.wasteStream}
            onChange={(e) => setNewBin((s) => ({ ...s, wasteStream: e.target.value }))}
            placeholder="Fraktion (fx Madaffald)"
          />
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={newBin.municipality}
            onChange={(e) => setNewBin((s) => ({ ...s, municipality: e.target.value }))}
            placeholder="Kommune (valgfri)"
          />
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={newBin.addressLine1}
            onChange={(e) => setNewBin((s) => ({ ...s, addressLine1: e.target.value }))}
            placeholder="Adresse (valgfri)"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={newBin.postalCode}
              onChange={(e) => setNewBin((s) => ({ ...s, postalCode: e.target.value }))}
              placeholder="Postnr"
            />
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={newBin.city}
              onChange={(e) => setNewBin((s) => ({ ...s, city: e.target.value }))}
              placeholder="By"
            />
          </div>
        </div>
        <button
          className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          type="button"
          disabled={creating || !newBin.label}
          onClick={() => createBin().catch((e) => setError(e instanceof Error ? e.message : String(e)))}
        >
          Opret
        </button>
      </div>

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
            <a className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50" href={`/k/${encodeURIComponent(selectedToken)}`}>
              Åbn /k
            </a>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="text-sm font-medium">Tilføj claim-kontakt</div>
            <div className="grid gap-2">
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={contact.role}
                onChange={(e) => setContact((s) => ({ ...s, role: e.target.value === 'worker' ? 'worker' : 'owner' }))}
              >
                <option value="owner">owner</option>
                <option value="worker">worker</option>
              </select>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={contact.email}
                onChange={(e) => setContact((s) => ({ ...s, email: e.target.value }))}
                placeholder="email (valgfri)"
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={contact.phone}
                onChange={(e) => setContact((s) => ({ ...s, phone: e.target.value }))}
                placeholder="telefon (valgfri)"
              />
            </div>
            <button
              className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
              type="button"
              onClick={() => addClaimContact().catch((e) => setError(e instanceof Error ? e.message : String(e)))}
            >
              Tilføj
            </button>
            <div className="text-xs text-neutral-500">
              Scanner bruger herefter “Jeg er ejer/medarbejder” og får OTP sendt automatisk til registreret kontakt.
            </div>
          </div>
        </>
      ) : null}

      <div className="pt-2">
        <a className="text-sm underline" href={`/label/${encodeURIComponent(sampleToken)}`}>
          {t(locale, 'generateSample')}
        </a>
      </div>

      {info ? <div className="text-sm text-green-700">{info}</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
