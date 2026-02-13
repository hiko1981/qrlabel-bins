'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

export function ClaimRegister({ claimToken, disabled }: { claimToken: string; disabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => {
      setHint('Hvis intet sker, så prøv igen eller opdatér siden.');
    }, 2500);
    return () => clearTimeout(t);
  }, [busy]);

  function friendlyError(message: string) {
    if (message.includes('Missing challenge')) return 'Session udløbet. Åbn claim-linket igen.';
    if (message.includes('Claim token already used')) return 'Dette claim-link er allerede brugt.';
    if (message.includes('Claim token expired')) return 'Dette claim-link er udløbet.';
    if (message.includes('The operation either timed out or was not allowed')) return 'Passkey blev afbrudt.';
    if (message.includes('NotAllowedError')) return 'Passkey blev afbrudt.';
    return message;
  }

  async function register() {
    setError(null);
    setHint(null);
    setBusy(true);
    try {
      const optionsRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claimToken }),
      });
      if (!optionsRes.ok) throw new Error(await optionsRes.text());
      const options = await optionsRes.json();

      const attResp = await startRegistration(options);
      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ claimToken, response: attResp }),
      });
      if (!verifyRes.ok) throw new Error(await verifyRes.text());
      const { redirectTo } = (await verifyRes.json()) as { redirectTo: string };
      window.location.assign(redirectTo);
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || busy}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        onClick={() => register()}
      >
        {busy ? 'Åbner passkey…' : 'Opret passkey på denne enhed'}
      </button>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {hint ? <div className="text-xs text-neutral-500">{hint}</div> : null}
      <div className="text-xs text-neutral-500">Passkey binder adgang til denne enhed/browser.</div>
    </div>
  );
}
