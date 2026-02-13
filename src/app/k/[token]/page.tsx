import { notFound } from 'next/navigation';
import { getBinByToken } from '@/lib/data';
import { getRolesForUserInBinToken } from '@/lib/data';
import { getSession } from '@/lib/session';
import { SessionStatus } from './session-status';

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

      <div className="mt-6 text-xs text-neutral-500">
        Canonical: <span className="font-mono">qrlabel.one/k/{token}</span>
      </div>
    </main>
  );
}
