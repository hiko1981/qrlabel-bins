import 'server-only';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function isAdminUser(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('admin_members').select('id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

export async function requireAdminSession(userId: string) {
  try {
    const ok = await isAdminUser(userId);
    if (!ok) return new NextResponse('Forbidden', { status: 403 });
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new NextResponse(msg, { status: 500 });
  }
}

