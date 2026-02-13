import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getBinIdByToken } from '@/lib/data';
import { getLocaleFromHeaders } from '@/lib/i18n';
import { randomNumericCode, sha256Base64Url } from '@/lib/crypto';
import { deliverOtp } from '@/lib/otpDelivery';

const Body = z.object({
  binToken: z.string().min(6),
  role: z.enum(['owner', 'worker']),
  email: z.string().email().optional(),
  phone: z.string().min(3).optional(),
});

export async function POST(req: Request) {
  const body = Body.parse(await req.json());
  const email = body.email?.toLowerCase();
  const phoneRaw = body.phone;
  const phone = phoneRaw
    ? (() => {
        const digits = phoneRaw.replace(/[^\d+]/g, '');
        const onlyDigits = digits.startsWith('+') ? digits.slice(1) : digits;
        if (onlyDigits.startsWith('45') && onlyDigits.length === 10) return onlyDigits.slice(2);
        return onlyDigits;
      })()
    : undefined;
  const contactType = email ? 'email' : phone ? 'phone' : null;
  const contactValue = email ?? phone ?? null;

  const binId = await getBinIdByToken(body.binToken);
  if (!binId) return new NextResponse('Unknown bin token', { status: 404 });

  const supabase = getSupabaseAdmin();
  const { data: contactsRaw, error: contactsErr } = await supabase
    .from('bin_claim_contacts')
    .select('id, email, phone, activated_at')
    .eq('bin_id', binId)
    .eq('role', body.role);
  if (contactsErr) return new NextResponse(contactsErr.message, { status: 500 });
  if (!contactsRaw || contactsRaw.length === 0) return new NextResponse('Not allowed', { status: 403 });

  // Best-effort merge: if there is exactly one inactive email-only row and one inactive phone-only row,
  // merge them into a single row so the owner gets the same code on both channels.
  // This handles the common "one owner with both email+phone" setup even if added as two rows.
  let contacts = contactsRaw as Array<{ id: string; email: string | null; phone: string | null; activated_at: string | null }>;
  try {
    const inactive = contacts.filter((c) => !c.activated_at);
    const hasCombined = inactive.some((c) => Boolean(c.email) && Boolean(c.phone));
    if (!hasCombined) {
      const emailOnly = inactive.filter((c) => Boolean(c.email) && !c.phone);
      const phoneOnly = inactive.filter((c) => Boolean(c.phone) && !c.email);

      const distinctEmails = new Set(emailOnly.map((c) => String(c.email).toLowerCase()));
      const distinctPhones = new Set(phoneOnly.map((c) => String(c.phone)));

      // If there's effectively one person represented as multiple rows (duplicates),
      // consolidate into a single combined row.
      if (distinctEmails.size === 1 && distinctPhones.size === 1 && emailOnly.length >= 1 && phoneOnly.length >= 1) {
        const primary = emailOnly[0]!;
        const phoneValue = phoneOnly[0]!.phone;

        await supabase
          .from('bin_claim_contacts')
          .update({ phone: phoneValue })
          .eq('id', primary.id)
          .is('activated_at', null);

        const idsToDelete = [...emailOnly.slice(1).map((c) => c.id), ...phoneOnly.map((c) => c.id)];
        if (idsToDelete.length > 0) {
          await supabase.from('bin_claim_contacts').delete().in('id', idsToDelete).is('activated_at', null);
        }

        // Refresh
        const { data: merged } = await supabase
          .from('bin_claim_contacts')
          .select('id, email, phone, activated_at')
          .eq('bin_id', binId)
          .eq('role', body.role);
        if (merged && merged.length > 0) contacts = merged as any;
      }
    }
  } catch {
    // Ignore merge errors; we'll proceed with current contacts.
  }

  const inactiveContacts = contacts.filter((c) => !c.activated_at);
  const allowedTargets = inactiveContacts
    .flatMap((c) => [
      c.phone ? { type: 'phone' as const, value: String(c.phone), contactId: String(c.id) } : null,
      c.email
        ? { type: 'email' as const, value: String(c.email).toLowerCase(), contactId: String(c.id) }
        : null,
    ])
    .filter((x): x is { type: 'phone' | 'email'; value: string; contactId: string } => Boolean(x));

  if (allowedTargets.length === 0) {
    return new NextResponse('Already activated', { status: 409 });
  }

  if (contactType && contactValue) {
    const ok = allowedTargets.some((t) => t.type === contactType && t.value === contactValue);
    if (!ok) return new NextResponse('Not allowed', { status: 403 });
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const locale = getLocaleFromHeaders(req.headers);
  const targetsToSend =
    contactType && contactValue
      ? allowedTargets.filter((t) => t.type === contactType && t.value === contactValue)
      : allowedTargets;

  const created: string[] = [];
  const codesByContact = new Map<string, string>();
  for (const t of targetsToSend) {
    const perContactCode = codesByContact.get(t.contactId) ?? randomNumericCode(6);
    codesByContact.set(t.contactId, perContactCode);

    const codeHash = sha256Base64Url(`${perContactCode}:${binId}:${body.role}:${t.type}:${t.value}`);
    const { data: verification, error } = await supabase
      .from('contact_verifications')
      .insert({
        contact_id: t.contactId,
        bin_id: binId,
        role: body.role,
        contact_type: t.type,
        contact_value: t.value,
        code_hash: codeHash,
        expires_at: expiresAt,
        user_agent: req.headers.get('user-agent'),
        locale,
      })
      .select('id')
      .single();
    if (error) return new NextResponse(error.message, { status: 500 });
    created.push(verification.id);
  }

  try {
    const results = await Promise.allSettled(
      targetsToSend.map((t) =>
        (() => {
          const c = codesByContact.get(t.contactId);
          if (!c) throw new Error('Missing per-contact code');
          return deliverOtp({
            target: t.type === 'email' ? { type: 'email', to: t.value } : { type: 'sms', to: t.value },
            code: c,
            binToken: body.binToken,
            role: body.role,
          });
        })(),
      ),
    );
    const ok = results.some((r) => r.status === 'fulfilled');
    if (!ok) {
      const reasons = results
        .filter((r) => r.status === 'rejected')
        .map((r) => String((r as PromiseRejectedResult).reason?.message ?? (r as PromiseRejectedResult).reason));
      throw new Error(reasons.join(' | ') || 'No delivery succeeded');
    }
  } catch (e) {
    const includeCode = process.env.NODE_ENV !== 'production';
    const msg = e instanceof Error ? e.message : String(e);
    if (includeCode) {
      return NextResponse.json({
        ok: true,
        verificationIds: created,
        devCode: codesByContact.values().next().value ?? null,
        warning: msg,
      });
    }
    return new NextResponse(
      `Kunne ikke sende kode. Konfigurér provider env vars. ${msg}`,
      { status: 501 },
    );
  }

  // Do not return code in production.
  const includeCode = process.env.NODE_ENV !== 'production';
  return NextResponse.json({
    ok: true,
    verificationIds: created,
    devCode: includeCode ? codesByContact.values().next().value ?? null : undefined,
  });
}
