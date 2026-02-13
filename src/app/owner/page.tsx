import { getSession } from '@/lib/session';
import { getMunicipalityPortalUrl, getOwnerBins, getRecentEventsForBins } from '@/lib/data';
import { PushToggle } from '@/components/push/PushToggle';
import { BinMarker } from '@/components/BinMarker';
import { NotificationPrefs } from '@/components/NotificationPrefs';
import { OwnerNavButton } from '@/components/OwnerNavButton';

function formatRelativeDay(d: Date) {
  const today = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.round((a - b) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'i dag';
  if (diffDays === -1) return 'i går';
  if (diffDays === 1) return 'i morgen';
  if (diffDays < 0) return `for ${Math.abs(diffDays)} dage siden`;
  return `om ${diffDays} dage`;
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

  const lastEmptied = [...events].find((e) => e.type === 'emptied_confirmed');
  const municipality = bins.find((b) => Boolean(b.municipality))?.municipality ?? null;
  const municipalityPortal = municipality ? await getMunicipalityPortalUrl(municipality) : null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-neutral-500">Dashboard</div>
          <div className="flex items-center gap-2">
            <BinMarker size={20} className="opacity-70" />
            <h1 className="text-3xl font-semibold tracking-tight">Owner</h1>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-2">
        <OwnerNavButton href="/owner/messages" label="Beskeder" />
        <OwnerNavButton href="/owner/location" label="Tilpas placering" />
        <OwnerNavButton href="/owner/bins" label="Mine affaldsspande" />
        <OwnerNavButton href="/owner/public" label="Klik her for at se hvad andre ser" />
        <OwnerNavButton href="/owner/bins?mode=remove" label="Fjern affaldsspand" />
      </div>

      <div className="mt-6 grid gap-2">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Seneste tømning</div>
            <div className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
              {lastEmptied ? formatRelativeDay(new Date(lastEmptied.created_at)) : 'ukendt'}
            </div>
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {lastEmptied ? new Date(lastEmptied.created_at).toLocaleString() : 'Ingen tømninger endnu.'}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Næste tømning</div>
            {municipalityPortal ? (
              <a
                className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700 underline"
                href={municipalityPortal}
                target="_blank"
                rel="noreferrer"
              >
                se kommuneportal
              </a>
            ) : (
              <div className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">ukendt</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <PushToggle role="owner" />
        <div className="mt-4">
          <NotificationPrefs />
        </div>
      </div>

    </main>
  );
}
