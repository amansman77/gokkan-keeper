import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import { ConsultingRequestSchema } from '@gokkan-keeper/shared';

export const publicRouter = new Hono<{ Bindings: Env }>();

publicRouter.get('/portfolio', async (c) => {
  const db = new DBClient(c.env.DB);
  const portfolio = await db.getPublicPortfolioEntries();
  return c.json(portfolio);
});

publicRouter.post('/consulting-request', async (c) => {
  try {
    const webhookUrl = c.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return c.json({ error: 'DISCORD_WEBHOOK_URL is not configured' }, 503);
    }

    const body = await c.req.json();
    const validated = ConsultingRequestSchema.parse(body);
    const requestId = `CR-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const createdAt = new Date().toISOString();

    const content = [
      '📩 New Consulting Request',
      `Request ID: ${requestId}`,
      `Created At: ${createdAt}`,
      `Email: ${validated.email}`,
      `Portfolio Size Range: ${validated.portfolioSizeRange || '-'}`,
      `Risk Tolerance: ${validated.riskTolerance}`,
      `Investment Horizon: ${validated.investmentHorizon}`,
      `Discord Handle: ${validated.discordHandle || '-'}`,
      '',
      'Current Concern:',
      validated.currentConcern,
    ].join('\n');

    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Gokkan Keeper',
        content,
      }),
    });

    if (!discordResponse.ok) {
      return c.json({ error: 'Failed to send consulting request to Discord' }, 502);
    }

    return c.json({ ok: true, requestId }, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});
