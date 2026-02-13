import { useEffect } from 'react';

export function useWebOtp(params: { enabled: boolean; onCode: (code: string) => void }) {
  const { enabled, onCode } = params;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    const nav: any = navigator as any;
    if (!nav?.credentials?.get) return;

    const ac = new AbortController();
    const signal = ac.signal;

    (async () => {
      try {
        const otp: any = await nav.credentials.get({
          otp: { transport: ['sms'] },
          signal,
        });
        const code = String(otp?.code ?? '').trim();
        if (code) onCode(code);
      } catch {
        // ignore
      }
    })();

    return () => ac.abort();
  }, [enabled, onCode]);
}

