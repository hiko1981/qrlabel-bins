'use client';

import { useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

export function ClaimRegister({ claimToken, disabled }: { claimToken: string; disabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  type RegistrationOptions = Parameters<typeof startRegistration>[0];
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => {
      setHint('Hvis intet sker, så prøv igen eller opdatér siden.');
    }, 2500);
    return () => clearTimeout(t);
  }, [busy]);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    (async () => {
      try {
        setOptionsError(null);
        const optionsRes = await fetch('/api/webauthn/register/options', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ claimToken }),
        });
        if (!optionsRes.ok) {
          const text = await optionsRes.text().catch(() => '');
          throw new Error(text || `Kunne ikke forberede passkey (HTTP ${optionsRes.status})`);
        }
        const json = await optionsRes.json();
        if (!cancelled) setOptions(json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setOptionsError(msg || 'Kunne ikke forberede passkey');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [claimToken, disabled]);

  function friendlyError(message: string) {
    if (message.includes('Missing challenge')) return 'Session udløbet. Åbn claim-linket igen.';
    if (message.includes('Claim token already used')) return 'Dette claim-link er allerede brugt.';
    if (message.includes('Claim token expired')) return 'Dette claim-link er udløbet.';
    if (message.includes('The operation either timed out or was not allowed')) return 'Passkey blev afbrudt.';
    if (message.includes('NotAllowedError')) return 'Passkey blev afbrudt.';
    if (message.includes('NotSupportedError')) return 'Passkeys er ikke understøttet på denne enhed/browser.';
    return message;
  }

  async function register() {
    setError(null);
    setHint(null);
    setBusy(true);
    try {
      if (!options) throw new Error(optionsError || 'Forbereder passkey… prøv igen om et øjeblik.');

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
      const err = e as { message?: unknown; name?: unknown };
      const msg = (() => {
        if (typeof err?.message === 'string' && err.message.trim()) return err.message;
        if (typeof err?.name === 'string' && err.name.trim()) return err.name;
        return String(e);
      })();
      setError(friendlyError(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || busy || !options}
        className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        onClick={() => register()}
      >
        {options ? (busy ? 'Åbner passkey…' : 'Opret passkey på denne enhed') : 'Forbereder passkey…'}
      </button>
      {optionsError ? <div className="text-sm text-red-600">{optionsError}</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {hint ? <div className="text-xs text-neutral-500">{hint}</div> : null}
      <div className="text-xs text-neutral-500">Passkey binder adgang til denne enhed/browser.</div>
    </div>
  );
}
