import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFromDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function getArg(name: string) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  loadEnvFromDotEnvLocal();

  const emailArg = getArg('email')?.toLowerCase();
  const phoneArgRaw = getArg('phone');
  const phoneArg = phoneArgRaw
    ? (() => {
        const digits = phoneArgRaw.replace(/[^\d+]/g, '');
        const onlyDigits = digits.startsWith('+') ? digits.slice(1) : digits;
        if (onlyDigits.startsWith('45') && onlyDigits.length === 10) return onlyDigits.slice(2);
        return onlyDigits;
      })()
    : undefined;

  if (!emailArg && !phoneArg) {
    throw new Error('Usage: pnpm tsx scripts/remove-claim-contact.ts --email=... [--phone=...]');
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const clauses: string[] = [];
  if (emailArg) clauses.push(`email.eq.${emailArg}`);
  if (phoneArg) clauses.push(`phone.eq.${phoneArg}`);

  const { data: rows, error } = await supabase
    .from('bin_claim_contacts')
    .select('id')
    .or(clauses.join(','));
  if (error) throw new Error(error.message);

  const ids = (rows ?? []).map((r) => r.id);
  console.log(JSON.stringify({ found: ids.length }));
  if (ids.length === 0) return;

  const del = await supabase.from('bin_claim_contacts').delete().in('id', ids);
  if (del.error) throw new Error(del.error.message);

  console.log(JSON.stringify({ deleted: ids.length }));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

