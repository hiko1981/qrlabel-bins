import { AdminLabels } from './ui';
import { t } from '@/lib/uiText';

export default function AdminLabelsPage() {
  const locale = null;
  return (
    <main className="mx-auto max-w-xl p-6">
      <div className="text-xs text-neutral-500">{t(locale, 'admin')}</div>
      <h1 className="text-2xl font-semibold tracking-tight">{t(locale, 'labels')}</h1>
      <div className="mt-4 rounded-xl border bg-white p-4">
        <AdminLabels />
      </div>
    </main>
  );
}
