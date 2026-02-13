import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

export async function GET() {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('principal_notification_prefs')
    .select('push_enabled,sms_enabled,email_enabled')
    .eq('principal_id', sess.userId)
    .maybeSingle();
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({
    pushEnabled: data?.push_enabled ?? true,
    smsEnabled: data?.sms_enabled ?? true,
    emailEnabled: data?.email_enabled ?? true,
  });
}

export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const body = Body.parse(await req.json());
  if (body.pushEnabled === undefined && body.smsEnabled === undefined && body.emailEnabled === undefined) {
    return new NextResponse('Missing fields', { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('principal_notification_prefs').upsert({
    principal_id: sess.userId,
    push_enabled: body.pushEnabled ?? undefined,
    sms_enabled: body.smsEnabled ?? undefined,
    email_enabled: body.emailEnabled ?? undefined,
    updated_at: new Date().toISOString(),
  });
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}

