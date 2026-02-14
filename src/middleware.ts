import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function stripPort(host: string) {
  return host.split(':')[0] ?? host;
}

const LABEL_HOSTS = new Set(['qrlabel.eu', 'www.qrlabel.eu']);
const QRX_HOSTS = new Set(['qrx.dk', 'www.qrx.dk']);

export function middleware(req: NextRequest) {
  const host = stripPort(req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '');
  const url = req.nextUrl;

  // Hide locator token from the browser URL by redirecting /k/<token> -> /k and storing token in a cookie.
  const isAppHost =
    LABEL_HOSTS.has(host) ||
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
        maxAge: 60 * 60 * 24 * 180,
      });
      return res;
    }
  }

  const isRedirectHost = QRX_HOSTS.has(host);
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
  // IMPORTANT: Do NOT redirect to qrlabel.one (it is reserved/used elsewhere and may redirect to avira.one).
  // Keep scan/auth flows on qrlabel.eu.
  return NextResponse.redirect(new URL(`/k/${encodeURIComponent(token)}`, 'https://qrlabel.eu'), 307);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
