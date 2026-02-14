import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function stripPort(host: string) {
  return host.split(':')[0] ?? host;
}

const LABEL_HOSTS = new Set(['qrlabel.eu', 'www.qrlabel.eu']);
const APP_HOSTS = new Set(['qrlabel.one', 'www.qrlabel.one']);
const QRX_HOSTS = new Set(['qrx.dk', 'www.qrx.dk']);

export function middleware(req: NextRequest) {
  const host = stripPort(req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '');
  const url = req.nextUrl;

  // Canonicalize auth/app flows to qrlabel.one (passkeys are bound to rpID/origin).
  if (LABEL_HOSTS.has(host)) {
    const isNextInternal = url.pathname.startsWith('/_next') || url.pathname.startsWith('/api/qr');
    if (!isNextInternal) {
      const shouldMoveToAppHost =
        url.pathname === '/k' ||
        url.pathname.startsWith('/k/') ||
        url.pathname === '/owner' ||
        url.pathname.startsWith('/owner/') ||
        url.pathname === '/claim-access' ||
        url.pathname.startsWith('/claim/') ||
        url.pathname.startsWith('/api/webauthn') ||
        url.pathname.startsWith('/api/session') ||
        url.pathname.startsWith('/api/auth/logout') ||
        url.pathname.startsWith('/api/owner') ||
        url.pathname.startsWith('/api/worker');
      if (shouldMoveToAppHost) {
        const to = new URL(req.url);
        to.host = 'qrlabel.one';
        to.protocol = 'https:';
        return NextResponse.redirect(to, 307);
      }
    }
  }

  // Hide locator token from the browser URL by redirecting /k/<token> -> /k and storing token in a cookie.
  const isAppHost =
    LABEL_HOSTS.has(host) ||
    APP_HOSTS.has(host) ||
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
  return NextResponse.redirect(new URL(`/k/${encodeURIComponent(token)}`, 'https://qrlabel.one'), 307);
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};
