import Link from 'next/link';
import { getSession } from '@/lib/session';
import { getBinByToken, getRolesForUserInBinToken } from '@/lib/data';
import { SessionStatus } from './[token]/session-status';
import { LocationShare } from './[token]/public-location';
import { WorkerActions } from './[token]/worker-actions';
import { PushToggle } from '@/components/push/PushToggle';
import { BinMarker } from '@/components/BinMarker';

function maskToken(token: string) {
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export async function BinPage({ token }: { token: string }) {
  let bin: Awaited<ReturnType<typeof getBinByToken>> = null;
  try {
    bin = await getBinByToken(token);
  } catch (e) {
    console.error('getBinByToken failed', e);
  }

  const sess = await getSession();
  const initialSession = sess
    ? { authed: true as const, user: { id: sess.userId, roles: await getRolesForUserInBinToken(sess.userId, token) } }
    : { authed: false as const };

  if (!bin) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <BinMarker size={16} className="opacity-70" />
              <span>Affaldsspand</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Bin</h1>
            <div className="mt-2 text-sm text-neutral-700">Kunne ikke hente bin-data lige nu. Prøv igen om lidt.</div>
            <div className="mt-2 text-xs text-neutral-500 font-mono">ID: {maskToken(token)}</div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-white p-4">
          <SessionStatus binToken={token} initial={initialSession} />
        </div>

        <div className="mt-6 rounded-xl border bg-white p-4">
          <LocationShare binToken={token} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <BinMarker size={16} className="opacity-70" />
            <span>Affaldsspand</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{bin.label}</h1>
          {bin.municipality ? <div className="mt-1 text-sm text-neutral-600">{bin.municipality}</div> : null}
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <SessionStatus binToken={token} initial={initialSession} />
      </div>

      {initialSession.authed && initialSession.user.roles.includes('owner') ? (
        <div className="mt-6 rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">Owner</div>
            <Link className="text-sm underline" href="/owner">
              Åbn dashboard
            </Link>
          </div>
          <div className="mt-3">
            <PushToggle role="owner" />
          </div>
        </div>
      ) : null}

      {initialSession.authed && initialSession.user.roles.includes('worker') ? (
        <div className="mt-6 rounded-xl border bg-white p-4">
          <WorkerActions binToken={token} />
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border bg-white p-4">
        <LocationShare binToken={token} />
      </div>
    </main>
  );
}

