import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function stripPort(host: string) {
  return host.split(':')[0] ?? host;
}

export function middleware(req: NextRequest) {
  const host = stripPort(req.headers.get('host') ?? '');
  const url = req.nextUrl;

  const isQrz = host === 'qrz.dk' || host === 'www.qrz.dk';
  if (!isQrz) return NextResponse.next();

  const pathname = url.pathname;
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  let token: string | null = null;
  if (pathname.startsWith('/k/')) {
    token = pathname.slice('/k/'.length).split('/')[0] ?? null;
  } else {
    const seg = pathname.replace(/^\/+/, '').split('/')[0];
    if (seg) token = seg;
  }

  if (!token) return NextResponse.redirect(new URL('https://qrlabel.one/', req.url), 308);
  return NextResponse.redirect(new URL(`/k/${encodeURIComponent(token)}`, 'https://qrlabel.one'), 308);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};

