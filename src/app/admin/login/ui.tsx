'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export function AdminLogin() {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locale = useMemo(() => (typeof navigator !== 'undefined' ? navigator.language : null), []);

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      const isEmail = emailOrPhone.includes('@');
      const res = await fetch('/api/admin/auth/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: isEmail ? emailOrPhone : undefined, phone: !isEmail ? emailOrPhone : undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { verificationId: string; devCode?: string; warning?: string };
      setVerificationId(data.verificationId);
      setDevCode(data.devCode ?? null);
      if (data.warning) setError(data.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ verificationId, code }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { redirectTo?: string };
      window.location.assign(data.redirectTo ?? '/admin/labels');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function passkeyLogin() {
    setError(null);
    setBusy(true);
    try {
      const optionsRes = await fetch('/api/webauthn/admin/login/options', { method: 'POST' });
      if (!optionsRes.ok) throw new Error(await optionsRes.text());
      const options = await optionsRes.json();

      const authResp = await startAuthentication(options);
      const verifyRes = await fetch('/api/webauthn/admin/login/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response: authResp }),
      });
      if (!verifyRes.ok) throw new Error(await verifyRes.text());
      window.location.assign('/admin/labels');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function registerPasskey() {
    setError(null);
    setBusy(true);
    try {
      const optionsRes = await fetch('/api/webauthn/admin/register/options', { method: 'POST' });
      if (!optionsRes.ok) throw new Error(await optionsRes.text());
      const options = await optionsRes.json();

      const regResp = await startRegistration(options);
      const verifyRes = await fetch('/api/webauthn/admin/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response: regResp }),
      });
      if (!verifyRes.ok) throw new Error(await verifyRes.text());
      window.location.assign('/admin/labels');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">Log ind med passkey</div>
        <button
          type="button"
          disabled={busy}
          className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
          onClick={() => passkeyLogin()}
        >
          Log ind (passkey)
        </button>
      </div>

      <div className="h-px bg-neutral-200" />

      {!verificationId ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">Første gang (OTP)</div>
          <label className="text-sm">
            Email eller telefon
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              placeholder="mail@... eller +45..."
            />
          </label>
          <button
            type="button"
            disabled={busy || !emailOrPhone}
            className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => sendCode()}
          >
            Send kode
          </button>
          {devCode ? (
            <div className="text-xs text-neutral-500">
              DEV kode: <span className="font-mono">{devCode}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-sm font-medium">Indtast kode</div>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-cifret kode"
          />
          <button
            type="button"
            disabled={busy || !code}
            className="w-full rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => verifyCode()}
          >
            Verificér
          </button>
          <button
            type="button"
            disabled={busy}
            className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            onClick={() => registerPasskey()}
          >
            Registrér passkey (anbefalet)
          </button>
        </div>
      )}

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <div className="text-xs text-neutral-500">
        Efter du har registreret passkey, kan du logge ind uden SMS/email.
      </div>
      <div className="text-xs text-neutral-500">
        Locale: <span className="font-mono">{locale ?? '—'}</span>
      </div>
      <div className="text-xs text-neutral-500">
        <Link className="underline" href="/labels/sample">
          Test labels uden admin
        </Link>
      </div>
    </div>
  );
}

