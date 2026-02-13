import { ClaimAccess } from './ui';
import { Suspense } from 'react';

export default function ClaimAccessPage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="text-xs text-neutral-500">Aktivér adgang</div>
      <h1 className="text-2xl font-semibold tracking-tight">Claim owner/worker</h1>
      <div className="mt-4 rounded-xl border bg-white p-4">
        <Suspense fallback={<div className="text-sm text-neutral-600">Loader…</div>}>
          <ClaimAccess />
        </Suspense>
      </div>
    </main>
  );
}
