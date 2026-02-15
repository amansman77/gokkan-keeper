interface SeoOptions {
  title: string;
  description: string;
}

export function setSeo({ title, description }: SeoOptions) {
  if (typeof document === 'undefined') return;
  document.title = title;

  let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = description;
}
