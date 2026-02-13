'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export function OwnerNavButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const sp = useSearchParams();
  const from = sp.get('from');
  const url = from ? `${href}${href.includes('?') ? '&' : '?'}from=${encodeURIComponent(from)}` : href;

  return (
    <Link
      href={url}
      className="flex w-full items-center justify-between rounded-xl border bg-white px-4 py-4 text-base font-medium hover:bg-neutral-50"
    >
      <span>{label}</span>
      <span className="text-neutral-400">›</span>
    </Link>
  );
}

