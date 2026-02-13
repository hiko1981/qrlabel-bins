import { BinPage } from '../BinPage';

export default async function BinTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <BinPage token={token} />;
}
