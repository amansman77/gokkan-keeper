interface SeoOptions {
  title: string;
  description: string;
  robots?: string;
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

export function setSeo({ title, description, robots }: SeoOptions) {
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
}

export function setRobots(content: 'index, follow' | 'noindex, nofollow') {
  const robotsMeta = upsertMeta('robots');
  if (robotsMeta) {
    robotsMeta.content = content;
  }
}
