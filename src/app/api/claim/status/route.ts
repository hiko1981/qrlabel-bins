import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Query = z.object({
  claimToken: z.string().min(10),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { claimToken } = Query.parse({ claimToken: url.searchParams.get('claimToken') });

  const supabase = getSupabaseAdmin();
  const { data: claim, error: claimErr } = await supabase
    .from('claim_tokens')
    .select('token,user_id,bin_token,role,created_at,expires_at,used_at')
    .eq('token', claimToken)
    .maybeSingle();
  if (claimErr) return new NextResponse(claimErr.message, { status: 500 });
  if (!claim) return new NextResponse('Not found', { status: 404 });

  const { count: credCount, error: credErr } = await supabase
    .from('webauthn_credentials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', claim.user_id);
  if (credErr) return new NextResponse(credErr.message, { status: 500 });

  return NextResponse.json({
    ok: true,
    claim: {
      token: claim.token,
      binToken: claim.bin_token,
      role: claim.role,
      createdAt: claim.created_at,
      expiresAt: claim.expires_at,
      usedAt: claim.used_at,
      credentialCount: credCount ?? 0,
    },
  });
}

