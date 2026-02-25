export function normalizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return '/dashboard';
  if (raw.startsWith('/login')) return '/dashboard';
  return raw;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  const existing = document.querySelector('script[data-gsi-client="true"]');
  if (existing) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.gsiClient = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity script'));
    document.head.appendChild(script);
  });
}
