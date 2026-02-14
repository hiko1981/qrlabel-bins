import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { mustGetEnv } from '@/lib/env';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

const COOKIE_NAME = 'qrlabel_session';
const SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days

function getCookieDomainFromHost(host: string | null): string | undefined {
  const configured = process.env.SESSION_COOKIE_DOMAIN?.trim();
  if (configured) return configured;
  if (!host) return undefined;
  const hostname = host.split(':')[0]?.toLowerCase() ?? '';
  if (!hostname || hostname === 'localhost' || /^[\d.]+$/.test(hostname)) return undefined;
  // Default for production; override with SESSION_COOKIE_DOMAIN for other domains.
  if (hostname === 'qrlabel.eu' || hostname.endsWith('.qrlabel.eu')) return '.qrlabel.eu';
  return undefined;
}

function isSecureRequestUrl(url: string | null): boolean {
  if (!url) return process.env.NODE_ENV === 'production';
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return process.env.NODE_ENV === 'production';
  }
}

function getSecretKey() {
  const secret = mustGetEnv('SESSION_SECRET');
  return new TextEncoder().encode(secret);
}

export type SessionClaims = {
  userId: string;
};

async function createSessionToken(userId: string) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('180d')
    .sign(getSecretKey());
}

export async function setSession(userId: string) {
  const token = await createSessionToken(userId);

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

export async function applySessionToResponse(
  res: { cookies: { set: (name: string, value: string, opts: Partial<ResponseCookie>) => void } },
  userId: string,
  req: Request,
) {
  const token = await createSessionToken(userId);
  const host = req.headers.get('host');
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequestUrl(req.url),
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    domain: getCookieDomainFromHost(host),
  });
}

export function clearSessionOnResponse(
  res: { cookies: { set: (name: string, value: string, opts: Partial<ResponseCookie>) => void } },
  req: Request,
) {
  const host = req.headers.get('host');
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequestUrl(req.url),
    path: '/',
    maxAge: 0,
    domain: getCookieDomainFromHost(host),
  });
}

export async function getSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const userId = payload.userId;
    if (typeof userId !== 'string' || !userId) return null;
    return { userId };
  } catch {
    return null;
  }
}
