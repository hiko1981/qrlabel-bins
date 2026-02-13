import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { ClaimAccess } from './ui';

export default async function ClaimAccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initialRole = sp.role === 'worker' ? 'worker' : 'owner';
  const autoStart = sp.auto === '1' || sp.auto === 'true';

  const jar = await cookies();
  const tokenFromCookie = jar.get('qrlabel_last_bin_token')?.value ?? '';
  const tokenFromQuery = typeof sp.token === 'string' ? sp.token : '';
  const initialToken = tokenFromQuery || tokenFromCookie;

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
