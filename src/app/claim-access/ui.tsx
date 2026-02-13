'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export function ClaimAccess() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') ?? '';
  const initialRole = searchParams.get('role') === 'worker' ? 'worker' : 'owner';
  const auto = searchParams.get('auto') === '1';

  const [binToken, setBinToken] = useState(initialToken);
  const [role, setRole] = useState<'owner' | 'worker'>(initialRole);
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const isEmail = emailOrPhone.includes('@');
      const auto = !emailOrPhone;
      const res = await fetch('/api/claim/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          binToken,
          role,
          email: !auto && isEmail ? emailOrPhone : undefined,
          phone: !auto && !isEmail ? emailOrPhone : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { verificationIds?: string[]; devCode?: string };
      setVerificationId(data.verificationIds?.[0] ?? null);
      setDevCode(data.devCode ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/claim/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ verificationId: verificationId ?? undefined, code, binToken }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { claimUrl: string };
      window.location.assign(data.claimUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!verificationId ? (
        <>
          <div className="grid gap-2">
            <label className="text-sm">
              Bin token
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={binToken}
                onChange={(e) => setBinToken(e.target.value)}
                placeholder="fx AbC123..."
              />
            </label>
            <label className="text-sm">
              Rolle
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value === 'worker' ? 'worker' : 'owner')}
              >
                <option value="owner">owner</option>
                <option value="worker">worker</option>
              </select>
            </label>
            {!auto ? (
              <label className="text-sm">
                Email eller telefon (valgfri)
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="tom = send til foruddefinerede kontakter"
                />
              </label>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy || !binToken}
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => start()}
          >
            {auto ? 'Send kode til registreret kontakt' : 'Send kode'}
          </button>
          {devCode ? (
            <div className="text-xs text-neutral-500">
              DEV kode: <span className="font-mono">{devCode}</span>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <label className="text-sm">
            Indtast kode
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-cifret kode"
            />
          </label>
          <button
            type="button"
            disabled={busy || !code}
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => verify()}
          >
            Verificér
          </button>
          {devCode ? (
            <div className="text-xs text-neutral-500">
              DEV kode: <span className="font-mono">{devCode}</span>
            </div>
          ) : null}
        </>
      )}

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <div className="text-xs text-neutral-500">
        MANUAL STEP: I production skal koden sendes via email/SMS provider (se `docs/DEPLOY.md`).
      </div>
    </div>
  );
}
