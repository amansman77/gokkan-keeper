/**
 * Canonical API route exposure policy.
 *
 * There are two kinds of anonymous routes:
 * - mounts registered before the authentication middleware; and
 * - narrowly scoped exceptions on routers mounted after it.
 *
 * Keep both lists here so route composition and authentication cannot acquire
 * separate, undocumented ideas of what is public.
 */
export const API_ROUTE_PATHS = {
  health: '/health',
  auth: '/auth',
  public: '/public',
  publicAlias: '/api/public',
  marketIndices: '/market-indices',
  granaries: '/granaries',
  snapshots: '/snapshots',
  status: '/status',
  judgmentDiary: '/judgment-diary',
  positions: '/positions',
  positionsAlias: '/api/positions',
  alerts: '/alerts',
  alertRuns: '/alerts/run/',
} as const;

function isPathOrDescendant(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

/**
 * Return whether a request may cross the protected-router auth boundary.
 * Alert run handlers perform their own API_SECRET check.
 */
export function isAnonymousRequestAtAuthBoundary(pathname: string, method: string): boolean {
  if (pathname.startsWith(API_ROUTE_PATHS.alertRuns)) return true;

  return method === 'GET' && isPathOrDescendant(pathname, API_ROUTE_PATHS.judgmentDiary);
}
