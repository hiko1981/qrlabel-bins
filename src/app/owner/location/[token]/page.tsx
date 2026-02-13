import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getBinByToken, getLatestOwnerLocationForBin, getRolesForUserInBinToken } from '@/lib/data';
import { LocationPicker } from '@/components/LocationPicker';

function parsePoint(payload: unknown): { lat: number; lng: number } | null {
  if (!payload || typeof payload !== 'object') return null;
  const loc = (payload as { location?: unknown }).location;
  if (!loc || typeof loc !== 'object') return null;
  const lat = (loc as { lat?: unknown }).lat;
  const lng = (loc as { lng?: unknown }).lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

export default async function OwnerLocationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const sess = await getSession();
  if (!sess) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tilpas placering</h1>
        <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-neutral-700">Du er ikke logget ind.</div>
      </main>
    );
  }

  const roles = await getRolesForUserInBinToken(sess.userId, token);
  if (!roles.includes('owner')) notFound();

  const bin = await getBinByToken(token);
  if (!bin) notFound();

  const last = await getLatestOwnerLocationForBin(bin.id);
  const initialPoint = last ? parsePoint(last.payload) : null;
  const style = (() => {
    if (!last?.payload || typeof last.payload !== 'object') return 'map' as const;
    const ms = (last.payload as { mapStyle?: unknown }).mapStyle;
    return ms === 'satellite' ? ('satellite' as const) : ('map' as const);
  })();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tilpas placering</h1>
        <Link className="text-sm underline" href="/owner">
          Tilbage
        </Link>
      </div>

      <div className="mt-2 text-sm text-neutral-600">{bin.label}</div>

      <div className="mt-4">
        <LocationPicker binToken={token} initial={{ point: initialPoint, style }} />
      </div>
    </main>
  );
}
