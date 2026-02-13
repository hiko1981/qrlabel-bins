'use client';

import { useMemo, useState } from 'react';

type GeoPayload = {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
};

export function LocationShare({ binToken }: { binToken: string }) {
  const storageKey = useMemo(() => `qrlabel_location_shared:${binToken}`, [binToken]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(storageKey) === '1';
  });
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setError(null);
    if (done) return;
    if (!('geolocation' in navigator)) {
      setError('Din browser understøtter ikke lokation.');
      return;
    }

    setBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 15000,
        }),
      );
      const payload: GeoPayload = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        timestamp: pos.timestamp,
      };

      const res = await fetch('/api/public/location', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ binToken, location: payload }),
      });
      if (!res.ok) throw new Error(await res.text());
      window.localStorage.setItem(storageKey, '1');
      setDone(true);
    } catch (e) {
      const msg = e instanceof GeolocationPositionError ? e.message : e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Står den forkert?</div>
      <div className="text-sm text-neutral-700">Del din lokation én gang, så owner kan finde den.</div>
      <button
        type="button"
        disabled={busy || done}
        className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        onClick={() => share()}
      >
        {done ? 'Lokation delt' : busy ? 'Deler…' : 'Del din lokation'}
      </button>
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}

