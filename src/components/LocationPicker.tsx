'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

type LatLng = { lat: number; lng: number };
type MapStyle = 'map' | 'satellite';

const LeafletPickerMap = dynamic(() => import('@/components/LeafletPickerMap').then((m) => m.LeafletPickerMap), {
  ssr: false,
});

export function LocationPicker({
  binToken,
  initial,
}: {
  binToken: string;
  initial: { point: LatLng | null; style: MapStyle };
}) {
  const [point, setPoint] = useState<LatLng | null>(initial.point);
  const [mapStyle, setMapStyle] = useState<MapStyle>(initial.style);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const center = useMemo<LatLng>(() => point ?? { lat: 55.4, lng: 11.7 }, [point]);

  useEffect(() => {
    if (point) return;
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8_000 },
    );
  }, [point]);

  async function save() {
    if (!point) return;
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      const res = await fetch('/api/owner/set-location', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          binToken,
          lat: point.lat,
          lng: point.lng,
          mapStyle,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const tile =
    mapStyle === 'satellite'
      ? {
          url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles © Esri',
        }
      : {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          attribution: '© OpenStreetMap contributors',
        };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Vælg placering</div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${mapStyle === 'map' ? 'bg-black text-white' : 'bg-white'}`}
            onClick={() => setMapStyle('map')}
          >
            Kort
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${
              mapStyle === 'satellite' ? 'bg-black text-white' : 'bg-white'
            }`}
            onClick={() => setMapStyle('satellite')}
          >
            Satellit
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="h-[360px]">
          <LeafletPickerMap center={center} zoom={18} tile={tile} point={point} onPick={(p) => setPoint(p)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-neutral-500 font-mono">
          {point ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : 'Tryk på kortet'}
        </div>
        <button
          type="button"
          disabled={!point || busy}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => save()}
        >
          {busy ? 'Gemmer…' : 'Gem placering'}
        </button>
      </div>

      {ok ? <div className="text-sm text-green-700">Gemt.</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <div className="text-xs text-neutral-500">Tryk på kortet for at flytte markøren.</div>
    </div>
  );
}

