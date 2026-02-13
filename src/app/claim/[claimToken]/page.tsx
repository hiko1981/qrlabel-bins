import { notFound } from 'next/navigation';
import { getClaimInfo } from '@/lib/data';
import { ClaimRegister } from './register';

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ claimToken: string }>;
}) {
  const { claimToken } = await params;
  const claim = await getClaimInfo(claimToken);
  if (!claim) notFound();

  const isUsed = Boolean(claim.used_at);
  const isExpired = claim.expires_at ? new Date(claim.expires_at) <= new Date() : false;

  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="text-xs text-neutral-500">Passkey setup</div>
      <h1 className="text-2xl font-semibold tracking-tight">Aktivér adgang</h1>

      <div className="mt-4 rounded-xl border bg-white p-4 text-sm text-neutral-700">
        <div>
          Rolle: <span className="font-mono">{claim.role}</span>
        </div>
        <div className="mt-1">
          Spand: <span className="font-mono">/k/{claim.bin_token}</span>
        </div>
        {isUsed ? <div className="mt-2 text-red-600">Dette link er allerede brugt.</div> : null}
        {isExpired ? <div className="mt-2 text-red-600">Dette link er udløbet.</div> : null}
      </div>

      <div className="mt-6">
        <ClaimRegister claimToken={claimToken} disabled={isUsed || isExpired} />
      </div>
    </main>
  );
}

