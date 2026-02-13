import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type Bin = {
  id: string;
  label: string;
  municipality: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  wasteStream?: string | null;
};

export async function getBinByToken(token: string): Promise<Bin | null> {
  const supabase = getSupabaseAdmin();
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('bin_tokens')
    .select('bin_id')
    .eq('token', token)
    .maybeSingle();
  if (tokenErr) throw new Error(`bin_tokens lookup failed: ${tokenErr.message}`);
  if (!tokenRow?.bin_id) return null;

  const { data: binRow, error: binErr } = await supabase
    .from('bins')
    .select('id,label,municipality,address_line1,postal_code,city,country,waste_stream')
    .eq('id', tokenRow.bin_id)
    .maybeSingle();
  if (binErr) throw new Error(`bins lookup failed: ${binErr.message}`);
  if (!binRow) return null;

  return {
    id: binRow.id,
    label: binRow.label,
    municipality: binRow.municipality,
    addressLine1: binRow.address_line1 ?? null,
    postalCode: binRow.postal_code ?? null,
    city: binRow.city ?? null,
    country: binRow.country ?? null,
    wasteStream: binRow.waste_stream ?? null,
  };
}

export async function getRolesForUserInBinToken(userId: string, binToken: string) {
  const supabase = getSupabaseAdmin();
  const { data: tokenRow, error: tokenErr } = await supabase
    .from('bin_tokens')
    .select('bin_id')
    .eq('token', binToken)
    .maybeSingle();
  if (tokenErr || !tokenRow?.bin_id) return [];

  const { data, error } = await supabase
    .from('bin_members')
    .select('role')
    .eq('user_id', userId)
    .eq('bin_id', tokenRow.bin_id);
  if (error || !data) return [];
  return data.map((r) => r.role);
}

export async function getClaimInfo(claimToken: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('claim_tokens')
    .select('token, bin_token, role, used_at, expires_at')
    .eq('token', claimToken)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function getBinIdByToken(token: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('bin_tokens').select('bin_id').eq('token', token).maybeSingle();
  if (error || !data?.bin_id) return null;
  return data.bin_id as string;
}

export async function getOwnerBins(principalId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('bin_members')
    .select('bin:bins(id,label,municipality)')
    .eq('user_id', principalId)
    .eq('role', 'owner');
  if (error || !data) return [];
  type BinShape = { id: string; label: string; municipality: string | null };
  type Row = { bin: BinShape | BinShape[] | null };
  const rows = data as unknown as Row[];

  const bins = rows
    .map((r) => (Array.isArray(r.bin) ? r.bin[0] : r.bin))
    .filter((b): b is BinShape => Boolean(b))
    .map((bin) => ({
      id: bin.id,
      label: bin.label,
      municipality: bin.municipality ?? null,
    }));

  const binIds = bins.map((b) => b.id);
  const tokenMap = await getLocatorTokensForBins(binIds);

  return bins.map((b) => ({ ...b, locatorToken: tokenMap.get(b.id) ?? null }));
}

export async function getRecentEventsForBins(binIds: string[], limitPerBin = 20) {
  if (binIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('bin_events')
    .select('id,bin_id,type,payload,created_at,resolved_at,created_by_principal_id,public_locale')
    .in('bin_id', binIds)
    .order('created_at', { ascending: false })
    .limit(binIds.length * limitPerBin);
  if (error || !data) return [];
  return data as unknown as Array<{
    id: string;
    bin_id: string;
    type: string;
    payload: unknown;
    created_at: string;
    resolved_at: string | null;
    created_by_principal_id: string | null;
    public_locale: string | null;
  }>;
}

export async function resolveEvent(eventId: string) {
  const supabase = getSupabaseAdmin();
  // Only owners should be allowed by API route checks; here we just set resolved_at.
  return supabase.from('bin_events').update({ resolved_at: new Date().toISOString() }).eq('id', eventId);
}

export async function getMunicipalityPortalUrl(municipality: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('municipality_portals')
    .select('mitid_portal_url')
    .eq('municipality', municipality)
    .maybeSingle();
  if (error || !data?.mitid_portal_url) return null;
  return data.mitid_portal_url as string;
}

export async function getLocatorTokensForBins(binIds: string[]) {
  const map = new Map<string, string>();
  if (binIds.length === 0) return map;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('bin_tokens').select('bin_id,token').in('bin_id', binIds);
  if (error || !data) return map;
  const rows = data as unknown as Array<{ bin_id: string; token: string }>;
  for (const row of rows) {
    if (!map.has(row.bin_id)) map.set(row.bin_id, row.token);
  }
  return map;
}
