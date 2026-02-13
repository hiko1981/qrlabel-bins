'use client';

import { useEffect, useState } from 'react';

type Template = { id: string; title: string; body: string };

export function WorkerActions({ binToken }: { binToken: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    fetch('/api/worker/hangtag-templates')
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
        setTemplateId((d.templates?.[0]?.id as string) ?? '');
      })
      .catch(() => {});
  }, []);

  async function send(type: 'visit_confirmed' | 'emptied_confirmed') {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/worker/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ binToken, type }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function issueTag() {
    setError(null);
    setBusy(true);
    try {
      const tmpl = templates.find((t) => t.id === templateId);
      const res = await fetch('/api/worker/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          binToken,
          type: 'tag_issued',
          payload: {
            templateId,
            templateTitle: tmpl?.title ?? null,
            templateBody: tmpl?.body ?? null,
            note: note || null,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Worker</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
          onClick={() => send('visit_confirmed')}
        >
          Kvitter for besøg
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
          onClick={() => send('emptied_confirmed')}
        >
          Kvitter for tømning
        </button>
      </div>

      <div className="rounded-xl border p-3">
        <div className="text-sm font-medium">Læg hangtag</div>
        <div className="mt-2 grid gap-2">
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <textarea
            className="min-h-20 rounded-lg border px-3 py-2 text-sm"
            placeholder="Valgfri note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !templateId}
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => issueTag()}
          >
            Læg hangtag
          </button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
    </div>
  );
}

