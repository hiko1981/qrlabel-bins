import crypto from 'crypto';

const OTP_STEP_SECONDS = 10 * 60; // 10 minutes

function getOtpSecret() {
  const secret =
    process.env.OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_SECRET ||
    '';
  if (!secret) throw new Error('Missing OTP_SECRET (or fallback secret)');
  return secret;
}

export function getOtpWindow(now = new Date()) {
  const seconds = Math.floor(now.getTime() / 1000);
  const window = Math.floor(seconds / OTP_STEP_SECONDS);
  const windowStartSeconds = window * OTP_STEP_SECONDS;
  const windowEndSeconds = windowStartSeconds + OTP_STEP_SECONDS;
  return {
    window,
    windowStart: new Date(windowStartSeconds * 1000),
    windowEnd: new Date(windowEndSeconds * 1000),
  };
}

export function otpCodeForContact(params: {
  contactId: string;
  binId: string;
  role: 'owner' | 'worker' | string;
  now?: Date;
}) {
  const { window } = getOtpWindow(params.now);
  const key = `${params.contactId}:${params.binId}:${params.role}:${window}`;
  const h = crypto.createHmac('sha256', getOtpSecret()).update(key).digest();
  const num = h.readUInt32BE(0) % 1_000_000;
  return String(num).padStart(6, '0');
}

