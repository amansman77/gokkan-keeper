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
  origin: ['http://localhost:5173', 'http://localhost:5174', 'capacitor://localhost'],
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

