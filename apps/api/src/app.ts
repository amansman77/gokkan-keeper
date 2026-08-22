import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import { alertsRouter } from './routes/alerts';
import { authRouter } from './routes/auth';
import { granariesRouter } from './routes/granaries';
import { judgmentDiaryRouter } from './routes/judgment-diary';
import { marketIndicesRouter } from './routes/market-indices';
import { positionsRouter } from './routes/positions';
import { publicRouter } from './routes/public';
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
  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/public', publicRouter);
  app.route('/api/public', publicRouter);
  app.route('/auth', authRouter);
}

function registerProtectedRoutes(app: Hono<{ Bindings: Env }>): void {
  app.route('/market-indices', marketIndicesRouter);
  app.route('/granaries', granariesRouter);
  app.route('/snapshots', snapshotsRouter);
  app.route('/status', statusRouter);
  app.route('/judgment-diary', judgmentDiaryRouter);
  app.route('/positions', positionsRouter);
  app.route('/api/positions', positionsRouter);
  app.route('/alerts', alertsRouter);
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
