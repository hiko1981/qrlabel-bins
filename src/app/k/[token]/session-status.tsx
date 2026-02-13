'use client';

import { useMemo, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authed'; user: { id: string; roles: string[] } };

type Initial =
  | { authed: false }
  | { authed: true; user: { id: string; roles: string[] } };

export function SessionStatus({ binToken, initial }: { binToken: string; initial: Initial }) {
  const [state, setState] = useState<SessionState>(() =>
    initial.authed ? { status: 'authed', user: initial.user } : { status: 'anonymous' },
  );
  const [error, setError] = useState<string | null>(null);

  const canOwnerLogin = useMemo(() => true, []);
  const canWorkerLogin = useMemo(() => true, []);

  async function refresh() {
    setError(null);
    const res = await fetch(`/api/session?binToken=${encodeURIComponent(binToken)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load session');
    const data = (await res.json()) as
      | { authed: false }
      | { authed: true; user: { id: string; roles: string[] } };
    setState(data.authed ? { status: 'authed', user: data.user } : { status: 'anonymous' });
  }

  async function login(role: 'owner' | 'worker') {
    setError(null);
    const optionsRes = await fetch('/api/webauthn/login/options', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ binToken, role }),
    });
    if (!optionsRes.ok) {
      const t = await optionsRes.text();
      throw new Error(t || 'Login options failed');
    }
    const options = await optionsRes.json();

    const authResp = await startAuthentication(options);
    const verifyRes = await fetch('/api/webauthn/login/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ binToken, role, response: authResp }),
    });
    if (!verifyRes.ok) {
      const t = await verifyRes.text();
      throw new Error(t || 'Login verify failed');
    }
    await refresh();
  }

  async function logout() {
    setError(null);
    await fetch('/api/auth/logout', { method: 'POST' });
    await refresh();
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Status</div>

      {state.status === 'anonymous' ? (
        <div className="space-y-3">
          <div className="text-sm text-neutral-700">Offentlig visning (ingen passkey).</div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
              disabled={!canOwnerLogin}
              onClick={() => login('owner').catch((e) => setError(e instanceof Error ? e.message : String(e)))}
            >
              Log ind som owner (passkey)
            </button>
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
              disabled={!canWorkerLogin}
              onClick={() => login('worker').catch((e) => setError(e instanceof Error ? e.message : String(e)))}
            >
              Log ind som worker (passkey)
            </button>
          </div>
        </div>
      ) : null}

      {state.status === 'authed' ? (
        <div className="space-y-3">
          <div className="text-sm text-neutral-700">
            Logget ind. Roller for denne spand: <span className="font-mono">{state.user.roles.join(', ') || '-'}</span>
          </div>
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={() => logout().catch((e) => setError(e instanceof Error ? e.message : String(e)))}
          >
            Log ud
          </button>
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
