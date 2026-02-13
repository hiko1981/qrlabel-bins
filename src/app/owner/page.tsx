import { getSession } from '@/lib/session';
import { getOwnerBins, getRecentEventsForBins } from '@/lib/data';
import { PushToggle } from '@/components/push/PushToggle';
import { BinMarker } from '@/components/BinMarker';

function formatEvent(type: string) {
  switch (type) {
    case 'misplaced_location_shared':
      return 'Lokation delt (forkert placering)';
    case 'tag_issued':
      return 'Hangtag lagt';
    case 'emptied_confirmed':
      return 'Tømning kvitteret';
    case 'visit_confirmed':
      return 'Besøg kvitteret';
    default:
      return type;
  }
}

function getSharedLocation(payload: unknown): { lat: number; lng: number } | null {
  if (!payload || typeof payload !== 'object') return null;
  const loc = (payload as { location?: unknown }).location;
  if (!loc || typeof loc !== 'object') return null;
  const lat = (loc as { lat?: unknown }).lat;
  const lng = (loc as { lng?: unknown }).lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng };
}

function mapsLink(payload: unknown) {
  const loc = getSharedLocation(payload);
  if (!loc) return null;
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
}

export default async function OwnerDashboard() {
  const sess = await getSession();
  if (!sess) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Owner</h1>
        <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-neutral-700">
          Du er ikke logget ind. Scan en spand og log ind som owner.
        </div>
      </main>
    );
  }

  const bins = await getOwnerBins(sess.userId);
  const binIds = bins.map((b) => b.id);
  const events = await getRecentEventsForBins(binIds, 20);

  const sortedEvents = [...events].sort((a, b) => {
    const aPriority = a.type === 'misplaced_location_shared' || a.type === 'tag_issued' ? 0 : 1;
    const bPriority = b.type === 'misplaced_location_shared' || b.type === 'tag_issued' ? 0 : 1;
    const aUnread = a.resolved_at ? 1 : 0;
    const bUnread = b.resolved_at ? 1 : 0;
    if (aUnread !== bUnread) return aUnread - bUnread;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-neutral-500">Dashboard</div>
          <div className="flex items-center gap-2">
            <BinMarker size={20} className="opacity-70" />
            <h1 className="text-3xl font-semibold tracking-tight">Owner</h1>
          </div>
          <div className="mt-1 text-sm text-neutral-600">Passkey login giver single-tap adgang.</div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <PushToggle role="owner" />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Dine spande</h2>
      <div className="mt-3 grid gap-2">
        {bins.length === 0 ? (
          <div className="rounded-xl border bg-white p-4 text-sm text-neutral-700">Ingen spande endnu.</div>
        ) : null}
        {bins.map((b) => (
          <div key={b.id} className="rounded-xl border bg-white p-4">
            <div className="text-sm font-medium">{b.label}</div>
            {b.municipality ? <div className="mt-1 text-xs text-neutral-500">{b.municipality}</div> : null}
            <div className="mt-3">
              {b.locatorToken ? (
                <a className="text-sm underline" href={`/k/${encodeURIComponent(b.locatorToken)}`}>
                  Åbn spand
                </a>
              ) : (
                <div className="text-xs text-neutral-500">Ingen token knyttet.</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Seneste hændelser</h2>
      <div className="mt-3 grid gap-2">
        {sortedEvents.length === 0 ? (
          <div className="rounded-xl border bg-white p-4 text-sm text-neutral-700">Ingen hændelser endnu.</div>
        ) : (
          sortedEvents.slice(0, 30).map((e) => (
            <div key={e.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{formatEvent(e.type)}</div>
                {!e.resolved_at && (e.type === 'misplaced_location_shared' || e.type === 'tag_issued') ? (
                  <form action={`/api/owner/resolve-event`} method="post">
                    <input type="hidden" name="eventId" value={e.id} />
                    <button className="rounded-lg border px-2 py-1 text-xs hover:bg-neutral-50" type="submit">
                      Marker som løst
                    </button>
                  </form>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-neutral-500">{new Date(e.created_at).toLocaleString()}</div>
              {e.type === 'misplaced_location_shared' ? (
                <div className="mt-2 text-sm text-neutral-700">
                  {mapsLink(e.payload) ? (
                  <a
                    className="underline"
                    href={mapsLink(e.payload)!}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Åbn i kort
                  </a>
                  ) : (
                    <div className="text-xs text-neutral-500">Lokation mangler.</div>
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
