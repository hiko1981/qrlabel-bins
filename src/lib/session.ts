import 'server-only';

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { mustGetEnv } from '@/lib/env';

const COOKIE_NAME = 'qrlabel_session';

function getSecretKey() {
  const secret = mustGetEnv('SESSION_SECRET');
  return new TextEncoder().encode(secret);
}

export type SessionClaims = {
  userId: string;
};

export async function setSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecretKey());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
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
