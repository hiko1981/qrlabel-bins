import { notFound } from 'next/navigation';
import { getBinByToken, getRolesForUserInBinToken } from '@/lib/data';
import { getSession } from '@/lib/session';
import { SessionStatus } from './session-status';
import { LocationShare } from './public-location';
import { WorkerActions } from './worker-actions';
import Link from 'next/link';
import { PushToggle } from '@/components/push/PushToggle';

export default async function BinTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bin = await getBinByToken(token);
  if (!bin) notFound();

  const sess = await getSession();
  const initialSession = sess
    ? { authed: true as const, user: { id: sess.userId, roles: await getRolesForUserInBinToken(sess.userId, token) } }
    : { authed: false as const };

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-neutral-500">Affaldsspand</div>
          <h1 className="text-2xl font-semibold tracking-tight">{bin.label}</h1>
          {bin.municipality ? (
            <div className="mt-1 text-sm text-neutral-600">{bin.municipality}</div>
          ) : null}
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

      <div className="mt-6 text-xs text-neutral-500">
        Canonical: <span className="font-mono">qrlabel.one/k/{token}</span>
      </div>
    </main>
  );
}
