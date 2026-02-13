import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function getRolesForPrincipalInBin(principalId: string, binId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('bin_members')
    .select('role')
    .eq('user_id', principalId)
    .eq('bin_id', binId);
  if (error || !data) return [];
  return data.map((r) => r.role as 'owner' | 'worker');
}

export async function requireRoleForBin(principalId: string, binId: string, role: 'owner' | 'worker') {
  const roles = await getRolesForPrincipalInBin(principalId, binId);
  if (!roles.includes(role)) throw new Error('forbidden');
}

