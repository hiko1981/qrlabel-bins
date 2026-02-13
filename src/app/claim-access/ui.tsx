'use client';

import { useEffect, useState } from 'react';
import { useWebOtp } from '@/components/useWebOtp';
import { startRegistration } from '@simplewebauthn/browser';

export function ClaimAccess({
  initialToken,
  initialRole,
  autoStart,
}: {
  initialToken: string;
  initialRole: 'owner' | 'worker';
  autoStart: boolean;
}) {
  const role = initialRole;

  const [binToken] = useState(initialToken);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [verificationIds, setVerificationIds] = useState<string[]>([]);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useWebOtp({
    enabled: awaitingCode,
    onCode: (c) => setCode(c.replace(/[^\d]/g, '').slice(0, 6)),
  });

  useEffect(() => {
    if (!autoStart) return;
    if (!binToken) return;
    if (awaitingCode) return;
    start().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, binToken]);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/claim/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          binToken,
          role,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { verificationIds?: string[]; devCode?: string };
      setVerificationIds(data.verificationIds ?? []);
      setDevCode(data.devCode ?? null);
      setAwaitingCode(true);
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
      const idsToTry = verificationIds.length > 0 ? verificationIds : [undefined];
      let data: { claimToken: string; claimUrl?: string } | null = null;
      let lastErr: string | null = null;

      for (const vid of idsToTry) {
        const res = await fetch('/api/claim/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ verificationId: vid, code, binToken }),
        });
        if (res.ok) {
          data = (await res.json()) as { claimToken: string; claimUrl?: string };
          break;
        }
        lastErr = await res.text().catch(() => 'Invalid code');
      }
      if (!data) throw new Error(lastErr || 'Invalid code');

      const optionsRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claimToken: data.claimToken }),
      });
      if (!optionsRes.ok) throw new Error(await optionsRes.text());
      const options = await optionsRes.json();

      const attResp = await startRegistration(options);
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claimToken: data.claimToken, response: attResp }),
      });
      if (!verifyRes.ok) throw new Error(await verifyRes.text());
      const { redirectTo } = (await verifyRes.json()) as { redirectTo: string };
      window.location.assign(redirectTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!awaitingCode ? (
        <>
          <div className="text-sm text-neutral-700">
            Koden sendes til den/de kontakt(er) som er registreret for denne spand ({role}).
          </div>
          <button
            type="button"
            disabled={busy || !binToken}
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => start()}
          >
            {autoStart && busy ? 'Sender…' : 'Send kode'}
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
              className="mt-1 w-full rounded-lg border px-3 py-3 text-center font-mono text-2xl tracking-[0.25em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="6-cifret kode"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <button
            type="button"
            disabled={busy || !code}
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => verify()}
          >
            Aktivér (opret passkey)
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
