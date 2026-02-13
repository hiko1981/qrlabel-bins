import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function stripPort(host: string) {
  return host.split(':')[0] ?? host;
}

export function middleware(req: NextRequest) {
  const host = stripPort(req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '');
  const url = req.nextUrl;

  // Hide locator token from the browser URL by redirecting /k/<token> -> /k and storing token in a cookie.
  const isAppHost =
    host === 'qrlabel.eu' ||
    host === 'www.qrlabel.eu' ||
    host === 'localhost' ||
    host.endsWith('.vercel.app');
  if (isAppHost) {
    const m = url.pathname.match(/^\/k\/([A-Za-z0-9_-]{6,64})\/?$/);
    if (m?.[1]) {
      const token = m[1];
      const res = NextResponse.redirect(new URL('/k', req.url), 307);
      res.cookies.set('qrlabel_last_bin_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: url.protocol === 'https:',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
  }

  const isQrx = host === 'qrx.dk' || host === 'www.qrx.dk';
  const isRedirectHost = isQrx;
  if (!isRedirectHost) return NextResponse.next();

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

  if (!token) return NextResponse.redirect(new URL('https://qrlabel.eu/', req.url), 307);
  return NextResponse.redirect(new URL(`/k/${encodeURIComponent(token)}`, 'https://qrlabel.eu'), 307);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
