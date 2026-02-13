import Image from 'next/image';

export function BinMarker({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/bin-marker.png"
      alt=""
      width={size}
      height={size}
      className={className}
      priority={false}
    />
  );
}

