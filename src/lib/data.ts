import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export type Bin = {
  id: string;
  label: string;
  municipality: string | null;
};

export async function getBinByToken(token: string): Promise<Bin | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('bin_tokens')
    .select('token, bin:bins(id,label,municipality)')
    .eq('token', token)
    .maybeSingle();
  const bin = data?.bin ? (Array.isArray(data.bin) ? data.bin[0] : data.bin) : null;
  if (error || !data || !bin) return null;
  return {
    id: bin.id,
    label: bin.label,
    municipality: bin.municipality,
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
