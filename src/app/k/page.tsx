import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BinPage } from './BinPage';
import { BinMarker } from '@/components/BinMarker';
import { getSession } from '@/lib/session';
import { getRolesForUserInBinToken } from '@/lib/data';

function isValidToken(token: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(token);
}

export default async function BinHiddenTokenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const jar = await cookies();
  const token = jar.get('qrlabel_last_bin_token')?.value ?? '';
  const sp = await searchParams;
  const stay = typeof sp.stay === 'string' ? sp.stay : null;

  if (!token || !isValidToken(token)) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <BinMarker size={16} className="opacity-70" />
          <span>Affaldsspand</span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Scan en QR label</h1>
        <div className="mt-3 text-sm text-neutral-700">
          Når du scanner en QR label, åbner denne side automatisk spanden (uden at vise token i adresselinjen).
        </div>
        <div className="mt-4 text-sm">
          <Link className="underline" href="/labels/sample">
            Åbn sample
          </Link>
        </div>
      </main>
    );
  }

  // Owner UX: if already logged in as owner for this bin, land in the hub.
  if (!stay) {
    const sess = await getSession();
    if (sess) {
      const roles = await getRolesForUserInBinToken(sess.userId, token);
      if (roles.includes('owner')) redirect(`/owner?from=${encodeURIComponent(token)}`);
    }
  }

  return <BinPage token={token} />;
}
