import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { API_ROUTE_PATHS } from './http/route-access';
import { authMiddleware } from './middleware/auth';
import { alertsRouter } from './routes/alerts';
import { alertThresholdsRouter } from './routes/alert-thresholds';
import { authRouter } from './routes/auth';
import { automationRouter } from './routes/automation';
import { cashFlowsRouter } from './routes/cash-flows';
import { granariesRouter } from './routes/granaries';
import { judgmentDiaryRouter } from './routes/judgment-diary';
import { marketIndicesRouter } from './routes/market-indices';
import { positionsRouter } from './routes/positions';
import { publicRouter } from './routes/public';
import { settingsRouter } from './routes/settings';
import { snapshotsRouter } from './routes/snapshots';
import { statusRouter } from './routes/status';

const ALLOWED_PRODUCTION_ORIGIN = 'https://gokkan-keeper.yetimates.com';

function resolveAllowedOrigin(origin: string): string | null {
  if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('capacitor://')) {
    return origin;
  }
  if (origin.endsWith('.pages.dev') || origin === ALLOWED_PRODUCTION_ORIGIN) {
    return origin;
  }
  return null;
}

function registerPublicRoutes(app: Hono<{ Bindings: Env }>): void {
  app.get(API_ROUTE_PATHS.health, (c) => c.json({ status: 'ok' }));
  app.route(API_ROUTE_PATHS.public, publicRouter);
  app.route(API_ROUTE_PATHS.publicAlias, publicRouter);
  app.route(API_ROUTE_PATHS.auth, authRouter);
}

function registerProtectedRoutes(app: Hono<{ Bindings: Env }>): void {
  app.route(API_ROUTE_PATHS.marketIndices, marketIndicesRouter);
  app.route(API_ROUTE_PATHS.granaries, granariesRouter);
  app.route(API_ROUTE_PATHS.snapshots, snapshotsRouter);
  app.route(API_ROUTE_PATHS.status, statusRouter);
  app.route(API_ROUTE_PATHS.judgmentDiary, judgmentDiaryRouter);
  app.route(API_ROUTE_PATHS.positions, positionsRouter);
  app.route(API_ROUTE_PATHS.positionsAlias, positionsRouter);
  app.route(API_ROUTE_PATHS.alerts, alertsRouter);
  app.route(API_ROUTE_PATHS.alertThresholds, alertThresholdsRouter);
  app.route(API_ROUTE_PATHS.settings, settingsRouter);
  app.route(API_ROUTE_PATHS.automation, automationRouter);
  app.route(API_ROUTE_PATHS.cashFlows, cashFlowsRouter);
}

/** Compose the HTTP application separately from the Worker runtime entry point. */
export function createApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.use('/*', cors({
    origin: resolveAllowedOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
  }));

  // Hono applies middleware in registration order. Anonymous endpoints must be
  // registered before the authentication boundary.
  registerPublicRoutes(app);
  app.use('/*', authMiddleware);
  registerProtectedRoutes(app);

  return app;
}
