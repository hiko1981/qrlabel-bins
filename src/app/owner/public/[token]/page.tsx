import { notFound } from 'next/navigation';
import { BinPageImpl } from '@/app/k/BinPage';
import { getBinByToken } from '@/lib/data';

export default async function OwnerPublicPreview({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bin = await getBinByToken(token);
  if (!bin) notFound();
  return <BinPageImpl token={token} forcePublic showBackToOwner />;
}

