export function parseLimit(
  raw: string | undefined,
  fallback: number,
  max: number,
): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (Number.isNaN(parsed)) return fallback;
  if (parsed < 1) return 1;
  if (parsed > max) return max;
  return parsed;
}
