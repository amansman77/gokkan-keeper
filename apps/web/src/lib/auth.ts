import { normalizeInternalPath } from '@gokkan-keeper/shared';

export function normalizeNextPath(raw: string | null): string {
  return normalizeInternalPath(raw);
}

let googleIdentityPromise: Promise<void> | null = null;

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined' || window.google?.accounts?.id) return Promise.resolve();
  if (googleIdentityPromise) return googleIdentityPromise;

  googleIdentityPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gsi-client="true"]');
    const script = existing ?? document.createElement('script');
    const cleanup = () => {
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
    };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => {
      cleanup(); script.remove(); reject(new Error('Failed to load Google Identity script'));
    };
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });
    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.gsiClient = 'true';
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => { googleIdentityPromise = null; throw error; });
  return googleIdentityPromise;
}
