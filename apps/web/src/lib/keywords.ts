const STOPWORDS = new Set([
  '그리고',
  '그러나',
  '하지만',
  '또한',
  '에서',
  '으로',
  '대한',
  '위한',
  '하는',
  '있는',
  '합니다',
  '입니다',
  'that',
  'this',
  'with',
  'from',
  'have',
]);

export function extractKeywords(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  const normalized = text
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_+=[\]{};':"\\|,.<>/?·\-]/g, ' ');

  for (const raw of normalized.split(/\s+/)) {
    const token = raw.trim();
    if (token.length < 2) continue;
    if (STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}
