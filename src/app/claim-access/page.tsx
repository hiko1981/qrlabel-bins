import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { ClaimAccess } from './ui';

export default async function ClaimAccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const roleParam = typeof sp.role === 'string' ? sp.role : Array.isArray(sp.role) ? sp.role[0] : undefined;
  const autoParam = typeof sp.auto === 'string' ? sp.auto : Array.isArray(sp.auto) ? sp.auto[0] : undefined;
  const tokenParam = typeof sp.token === 'string' ? sp.token : Array.isArray(sp.token) ? sp.token[0] : '';

  const initialRole = roleParam === 'worker' ? 'worker' : 'owner';
  const autoStart = autoParam === '1' || autoParam === 'true';

  const jar = await cookies();
  const tokenFromCookie = jar.get('qrlabel_last_bin_token')?.value ?? '';
  const initialToken = tokenParam || tokenFromCookie;

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="text-xs text-neutral-500">Aktivér adgang</div>
      <h1 className="text-2xl font-semibold tracking-tight">Claim owner/worker</h1>
      <div className="mt-4 rounded-xl border bg-white p-4">
        <Suspense fallback={<div className="text-sm text-neutral-600">Loader…</div>}>
          <ClaimAccess initialToken={initialToken} initialRole={initialRole} autoStart={autoStart} />
        </Suspense>
      </div>
    </main>
  );
}
