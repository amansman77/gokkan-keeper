type AnalyticsValue = string | number | boolean | null | undefined;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    plausible?: (eventName: string, options?: { props?: Record<string, AnalyticsValue> }) => void;
  }
}

export function trackEvent(eventName: string, props: Record<string, AnalyticsValue> = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (typeof window.plausible === 'function') {
      window.plausible(eventName, { props });
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, props);
    }
  } catch {
    // Ignore analytics errors to keep the form submission path stable.
  }
}
