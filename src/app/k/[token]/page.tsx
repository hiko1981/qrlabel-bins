import { redirect } from 'next/navigation';
import { BinPage } from '../BinPage';
import { getSession } from '@/lib/session';
import { getRolesForUserInBinToken } from '@/lib/data';

export default async function BinTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const stay = typeof sp.stay === 'string' ? sp.stay : null;

  // Owner UX: scanning/logging in should land in the hub (not on the bin page).
  // Allow bypass for debugging via ?stay=1, and keep public-preview flow isolated under /owner/public/*.
  if (!stay) {
    const sess = await getSession();
    if (sess) {
      const roles = await getRolesForUserInBinToken(sess.userId, token);
      if (roles.includes('owner')) {
        redirect(`/owner?from=${encodeURIComponent(token)}`);
      }
    }
  }
  return <BinPage token={token} />;
}
