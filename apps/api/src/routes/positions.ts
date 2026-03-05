import { Hono } from 'hono';
import type { Env } from '../types';
import { DBClient } from '../db/client';
import {
  CreatePositionSchema,
  UpdatePositionSchema,
  validatePublicPositionInput,
  type PublicPositionValidationError,
} from '@gokkan-keeper/shared';
import { enrichPositionsWithLiveQuotes, FscStockPriceService } from '../services/fsc-stock-price';

export const positionsRouter = new Hono<{ Bindings: Env }>();

function mapPublicPositionValidationError(error: PublicPositionValidationError): string {
  if (error === 'MISSING_PUBLIC_THESIS') {
    return 'Public position requires publicThesis.';
  }
  return 'Public position requires weightPercent, currentValue, or (quantity and avgCost).';
}

positionsRouter.get('/', async (c) => {
  const granaryId = c.req.query('granary_id');
  const db = new DBClient(c.env.DB);
  const positions = await db.getPositions(granaryId || undefined);
  return c.json(await enrichPositionsWithLiveQuotes(positions, c.env));
});

positionsRouter.get('/quote', async (c) => {
  const symbol = c.req.query('symbol');
  const assetType = c.req.query('assetType');
  if (!symbol) {
    return c.json({ error: 'symbol is required' }, 400);
  }

  const service = new FscStockPriceService(
    c.env.FSC_STOCK_API_SERVICE_KEY,
    c.env.FSC_STOCK_API_BASE_URL,
    c.env.DB,
  );

  if (!service.isEnabled()) {
    return c.json({ error: 'FSC_STOCK_API_SERVICE_KEY is not configured' }, 503);
  }

  try {
    const quote = await service.getQuoteBySymbol(symbol, { assetType: assetType ?? null });
    if (!quote) {
      return c.json({ error: 'Quote not found' }, 404);
    }

    return c.json({
      symbol,
      shortCode: quote.shortCode,
      name: quote.name,
      market: quote.marketCategory ?? 'KRX',
      assetType: 'STOCK',
      currentValue: quote.closePrice,
      currentUnitPrice: quote.closePrice,
      currentPriceAsOf: quote.asOfDate,
      currentPriceChange: quote.change,
      currentPriceChangeRate: quote.changeRate,
      currentPriceSource: 'FSC_STOCK_PRICE_API',
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to fetch quote' }, 502);
  }
});

positionsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);
  const position = await db.getPositionById(id);

  if (!position) {
    return c.json({ error: 'Position not found' }, 404);
  }

  return c.json((await enrichPositionsWithLiveQuotes([position], c.env))[0]);
});

positionsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const validated = CreatePositionSchema.parse(body);

    const publicValidationError = validatePublicPositionInput(validated);
    if (publicValidationError) {
      return c.json({ error: mapPublicPositionValidationError(publicValidationError) }, 400);
    }

    const db = new DBClient(c.env.DB);

    if (validated.granaryId) {
      const granary = await db.getGranaryById(validated.granaryId);
      if (!granary) {
        return c.json({ error: 'Granary not found' }, 404);
      }
    }

    const position = await db.createPosition(validated);
    return c.json(position, 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

positionsRouter.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = UpdatePositionSchema.parse(body);

    const db = new DBClient(c.env.DB);
    const existing = await db.getPositionById(id);
    if (!existing) {
      return c.json({ error: 'Position not found' }, 404);
    }

    const merged = {
      ...existing,
      ...validated,
    };

    const publicValidationError = validatePublicPositionInput(merged);
    if (publicValidationError) {
      return c.json({ error: mapPublicPositionValidationError(publicValidationError) }, 400);
    }

    if (validated.granaryId !== undefined && validated.granaryId !== null) {
      const granary = await db.getGranaryById(validated.granaryId);
      if (!granary) {
        return c.json({ error: 'Granary not found' }, 404);
      }
    }

    const updated = await db.updatePosition(id, validated);
    return c.json(updated);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Validation error', details: error.errors }, 400);
    }
    if (error.message?.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

positionsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const db = new DBClient(c.env.DB);
  const existing = await db.getPositionById(id);

  if (!existing) {
    return c.json({ error: 'Position not found' }, 404);
  }

  await db.deletePosition(id);
  return c.json({ ok: true });
});
