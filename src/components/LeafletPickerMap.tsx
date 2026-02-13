'use client';

import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';

type LatLng = { lat: number; lng: number };

export function LeafletPickerMap({
  center,
  zoom,
  tile,
  point,
  onPick,
}: {
  center: LatLng;
  zoom: number;
  tile: { url: string; attribution: string };
  point: LatLng | null;
  onPick: (p: LatLng) => void;
}) {
  function MapClick() {
    useMapEvents({
      click(e: LeafletMouseEvent) {
        onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return null;
  }

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
      <TileLayer url={tile.url} attribution={tile.attribution} />
      <MapClick />
      {point ? <Marker position={point} /> : null}
    </MapContainer>
  );
}
