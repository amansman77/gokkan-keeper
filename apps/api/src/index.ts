import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { authMiddleware } from './middleware/auth';
import { granariesRouter } from './routes/granaries';
import { snapshotsRouter } from './routes/snapshots';
import { statusRouter } from './routes/status';

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
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-API-Secret'],
  credentials: true,
}));

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// Auth middleware for all other routes
app.use('/*', authMiddleware);

// Routes
app.route('/granaries', granariesRouter);
app.route('/snapshots', snapshotsRouter);
app.route('/status', statusRouter);

export default app;

