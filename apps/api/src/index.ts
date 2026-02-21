import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import { granariesRouter } from './routes/granaries';
import { snapshotsRouter } from './routes/snapshots';
import { statusRouter } from './routes/status';
import { judgmentDiaryRouter } from './routes/judgment-diary';
import { publicRouter } from './routes/public';
import { positionsRouter } from './routes/positions';

const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('/*', cors({
  origin: (origin) => {
    // Allow localhost for development
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('capacitor://')) {
      return origin;
    }
    // Allow all Cloudflare Pages domains
    if (origin.endsWith('.pages.dev')) {
      return origin;
    }
    // Allow custom domains
    if (origin === 'https://gokkan-keeper.yetimates.com') {
      return origin;
    }
    // Deny all other origins (return null to reject)
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-API-Secret'],
  credentials: true,
}));

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Public read-only routes (no auth required)
app.route('/public', publicRouter);
app.route('/api/public', publicRouter);

// Auth middleware for all other routes
app.use('/*', authMiddleware);

// Routes
app.route('/granaries', granariesRouter);
app.route('/snapshots', snapshotsRouter);
app.route('/status', statusRouter);
app.route('/judgment-diary', judgmentDiaryRouter);
app.route('/positions', positionsRouter);
app.route('/api/positions', positionsRouter);

export default app;
