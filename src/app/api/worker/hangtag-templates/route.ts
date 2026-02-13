import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const DEFAULT_TEMPLATES = [
  { id: 'default-1', title: 'Fejlsortering', body: 'Indholdet er ikke sorteret korrekt.' },
  { id: 'default-2', title: 'Overfyldt', body: 'Spanden er overfyldt. Luk låg og undgå ekstra sække.' },
  { id: 'default-3', title: 'Adgang blokeret', body: 'Spanden kunne ikke tilgås. Fjern forhindringer.' },
];

export async function GET() {
  const sess = await getSession();
  if (!sess) return new NextResponse('Unauthorized', { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('hangtag_templates').select('id,title,body').order('created_at');
  if (error) return new NextResponse(error.message, { status: 500 });
  const templates = (data ?? []).map((t) => {
    const row = t as unknown as { id: string; title: string; body: string };
    return { id: row.id, title: row.title, body: row.body };
  });
  return NextResponse.json({ templates: templates.length ? templates : DEFAULT_TEMPLATES });
}
