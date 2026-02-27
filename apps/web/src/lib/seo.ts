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
