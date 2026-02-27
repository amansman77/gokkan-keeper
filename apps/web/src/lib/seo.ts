import { SITE_BASE_URL } from './config';

interface SeoOptions {
  title: string;
  description: string;
  robots?: string;
  canonicalPath?: string;
}

function upsertMeta(name: string): HTMLMetaElement | null {
  if (typeof document === 'undefined') return null;
  let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  return meta;
}

function upsertLink(rel: string): HTMLLinkElement | null {
  if (typeof document === 'undefined') return null;
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  return link;
}

export function setCanonical(pathname?: string) {
  if (typeof window === 'undefined') return;
  const path = pathname || window.location.pathname;
  const canonical = upsertLink('canonical');
  if (canonical) {
    canonical.href = `${SITE_BASE_URL}${path}`;
  }
}

export function setSeo({ title, description, robots, canonicalPath }: SeoOptions) {
  if (typeof document === 'undefined') return;
  document.title = title;

  const descriptionMeta = upsertMeta('description');
  if (descriptionMeta) {
    descriptionMeta.content = description;
  }

  if (robots) {
    const robotsMeta = upsertMeta('robots');
    if (robotsMeta) {
      robotsMeta.content = robots;
    }
  }

  setCanonical(canonicalPath);
}

export function setRobots(content: 'index, follow' | 'noindex, nofollow') {
  const robotsMeta = upsertMeta('robots');
  if (robotsMeta) {
    robotsMeta.content = content;
  }
}

export function setStructuredData(key: string, data: Record<string, any>) {
  if (typeof document === 'undefined') return;

  const selector = `script[type="application/ld+json"][data-seo-key="${key}"]`;
  let script = document.head.querySelector(selector) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-key', key);
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function clearStructuredData(key: string) {
  if (typeof document === 'undefined') return;
  const selector = `script[type="application/ld+json"][data-seo-key="${key}"]`;
  const script = document.head.querySelector(selector);
  if (script) {
    script.remove();
  }
}
