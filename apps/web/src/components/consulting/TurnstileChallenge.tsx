import { useEffect, useRef, useState } from 'react';

interface TurnstileApi {
  render(element: HTMLElement, options: { sitekey: string; action: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }): string;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: TurnstileApi } }
let scriptPromise: Promise<void> | undefined;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new Error('Challenge script unavailable')); };
    document.head.appendChild(script);
  }).catch((error: unknown) => { scriptPromise = undefined; throw error; });
  return scriptPromise;
}

export const CONSULTING_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
export default function TurnstileChallenge({ onToken, resetVersion }: { onToken: (token: string) => void; resetVersion: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stopped = false, widget: string | undefined;
    onToken('');
    if (!CONSULTING_SITE_KEY) return;
    void loadScript().then(() => {
      if (stopped || !container.current || !window.turnstile) return;
      widget = window.turnstile.render(container.current, {
        sitekey: CONSULTING_SITE_KEY, action: 'consulting', callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => { onToken(''); setFailed(true); },
      });
      setFailed(false);
    }).catch(() => { if (!stopped) setFailed(true); });
    return () => { stopped = true; if (widget) window.turnstile?.remove(widget); };
  }, [onToken, resetVersion]);
  return <div>
    <div ref={container} />
    {!CONSULTING_SITE_KEY || failed ? <p role="alert" className="text-sm text-danger">보안 확인을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.</p> : null}
  </div>;
}
