'use client';

import { useEffect, useMemo, useState } from 'react';

type Props = {
  role: 'owner' | 'worker';
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function PushToggle({ role }: Props) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userAgent = useMemo(() => (typeof navigator !== 'undefined' ? navigator.userAgent : undefined), []);

  useEffect(() => {
    const ok = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    if (!ok) return;
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return setEnabled(false);
      const sub = await reg.pushManager.getSubscription();
      setEnabled(Boolean(sub));
    })().catch(() => setEnabled(false));
  }, []);

  async function enable() {
    setError(null);
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('Notifikationer er ikke tilladt.');

      const reg = await navigator.serviceWorker.register('/sw.js');
      const { publicKey } = (await (await fetch('/api/push/vapid-public-key')).json()) as { publicKey: string };
      const appServerKey = urlBase64ToUint8Array(publicKey);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });

      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Ugyldig subscription.');

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          role,
          userAgent,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return setEnabled(false);
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      setEnabled(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return <div className="text-sm text-neutral-600">Notifikationer er ikke understøttet her.</div>;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Notifikationer</div>
      <div className="text-sm text-neutral-700">Få besked uden at scanne QR igen.</div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || enabled === true}
          className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => enable()}
        >
          Aktivér
        </button>
        <button
          type="button"
          disabled={busy || enabled === false}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
          onClick={() => disable()}
        >
          Deaktivér
        </button>
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}

