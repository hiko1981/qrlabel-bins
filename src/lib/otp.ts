import crypto from 'crypto';

const OTP_STEP_SECONDS = 10 * 60; // legacy fallback window

function getOtpSecret() {
  const secret =
    process.env.OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_SECRET ||
    '';
  if (!secret) throw new Error('Missing OTP_SECRET (or fallback secret)');
  return secret;
}

export function getOtpExpiresAt(now = new Date()) {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export function randomOtpSeed() {
  return crypto.randomBytes(18).toString('base64url');
}

export function otpCodeFromSeed(params: {
  seed: string;
  binId: string;
  role: 'owner' | 'worker' | string;
  contactType: 'email' | 'phone';
  contactValue: string;
}) {
  const key = `${params.seed}:${params.binId}:${params.role}:${params.contactType}:${params.contactValue}`;
  const h = crypto.createHmac('sha256', getOtpSecret()).update(key).digest();
  const num = h.readUInt32BE(0) % 1_000_000;
  return String(num).padStart(6, '0');
}

// Legacy: deterministic code by contact within short window (kept for backwards compatibility only)
export function otpCodeForContactLegacy(params: {
  contactId: string;
  binId: string;
  role: 'owner' | 'worker' | string;
  now?: Date;
}) {
  const seconds = Math.floor((params.now ?? new Date()).getTime() / 1000);
  const window = Math.floor(seconds / OTP_STEP_SECONDS);
  const key = `${params.contactId}:${params.binId}:${params.role}:${window}`;
  const h = crypto.createHmac('sha256', getOtpSecret()).update(key).digest();
  const num = h.readUInt32BE(0) % 1_000_000;
  return String(num).padStart(6, '0');
}
