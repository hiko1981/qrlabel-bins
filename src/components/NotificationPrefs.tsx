'use client';

import { useEffect, useState } from 'react';

type Prefs = { pushEnabled: boolean; smsEnabled: boolean; emailEnabled: boolean };

export function NotificationPrefs() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/notification-prefs', { cache: 'no-store' });
      if (!res.ok) return setPrefs({ pushEnabled: true, smsEnabled: true, emailEnabled: true });
      const data = (await res.json()) as Prefs;
      setPrefs(data);
    })().catch(() => setPrefs({ pushEnabled: true, smsEnabled: true, emailEnabled: true }));
  }, []);

  async function update(next: Partial<Prefs>) {
    if (!prefs) return;
    setError(null);
    setBusy(true);
    try {
      const optimistic = { ...prefs, ...next };
      setPrefs(optimistic);
      const res = await fetch('/api/notification-prefs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!prefs) return <div className="text-sm text-neutral-600">Loader…</div>;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Kanaler</div>
      <div className="grid gap-2 text-sm">
        <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <span>Push (passkey)</span>
          <input
            type="checkbox"
            checked={prefs.pushEnabled}
            disabled={busy}
            onChange={(e) => update({ pushEnabled: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <span>SMS (fallback)</span>
          <input
            type="checkbox"
            checked={prefs.smsEnabled}
            disabled={busy}
            onChange={(e) => update({ smsEnabled: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <span>Email (fallback)</span>
          <input
            type="checkbox"
            checked={prefs.emailEnabled}
            disabled={busy}
            onChange={(e) => update({ emailEnabled: e.target.checked })}
          />
        </label>
      </div>
      <div className="text-xs text-neutral-500">
        SMS/email bruges kun hvis der findes en registreret telefon/email for dig på en spand.
      </div>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}

