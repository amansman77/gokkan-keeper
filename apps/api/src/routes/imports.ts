import { Hono, type Context } from 'hono';
import {
  ApplyImportSchema, CreateImportSchema, FailImportSchema, ImportImageSchema, IMPORT_MAX_IMAGE_BYTES, IMPORT_MAX_IMAGES,
  OcrSubmissionSchema, type ImportJob,
} from '@gokkan-keeper/shared';
import { DBClient } from '../db/client';
import { ImportRepository } from '../db/repositories/import-repository';
import { internalError } from '../http/errors';
import { isValidImage } from '../services/image-validation';
import { applyResult, buildResult, ImportNotApplicable } from '../services/screenshot-import';
import type { Env } from '../types';

/**
 * Screenshot import (docs/SCREENSHOT_IMPORT.md). The owner's browser creates a
 * job, uploads images and later applies the reviewed result; the Mac OCR
 * worker (automation scope `imports:process`, see auth/automation.ts) leases
 * jobs, reads their images and reports OCR lines. Images are deleted as soon
 * as a result is recorded.
 */
export const importsRouter = new Hono<{ Bindings: Env }>();

const repo = (c: Context<{ Bindings: Env }>) => new ImportRepository(c.env.DB);
const isWorker = (c: Context<{ Bindings: Env }>) => c.get('authViaApiSecret') === true;

/** Owner endpoints refuse automation keys even if a scope ever overlapped. */
async function ownerJob(c: Context<{ Bindings: Env }>): Promise<ImportJob | Response> {
  if (isWorker(c)) return c.json({ error: 'Forbidden' }, 403);
  const job = await repo(c).getJob(c.req.param('id') ?? '');
  return job ?? c.json({ error: 'Import not found' }, 404);
}

/** The worker sees images and a job id only, never the result or granary. */
importsRouter.get('/next', async (c) => {
  if (!isWorker(c)) return c.json({ error: 'Forbidden' }, 403);
  await repo(c).purgeExpired();
  const leased = await repo(c).leaseNext();
  if (!leased) return c.body(null, 204);
  return c.json({ id: leased.job.id, images: leased.images.map((i) => ({ seq: i.seq, mime: i.mime })) });
});

importsRouter.post('/', async (c) => {
  if (isWorker(c)) return c.json({ error: 'Forbidden' }, 403);
  const parsed = CreateImportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Validation error', details: parsed.error.issues }, 400);
  const granary = await new DBClient(c.env.DB).getGranaryById(parsed.data.granaryId);
  if (!granary) return c.json({ error: 'Granary not found' }, 404);
  if (granary.currency !== 'KRW' && granary.currency !== 'USD') return c.json({ error: '원화·달러 곳간만 스크린샷으로 맞출 수 있어요' }, 400);
  await repo(c).purgeExpired();
  return c.json(await repo(c).createJob(granary.id), 201);
});

importsRouter.get('/:id', async (c) => {
  const job = await ownerJob(c);
  return job instanceof Response ? job : c.json(job);
});

importsRouter.put('/:id/images/:seq', async (c) => {
  const job = await ownerJob(c);
  if (job instanceof Response) return job;
  if (job.status !== 'draft') return c.json({ error: '이미 제출한 작업에는 이미지를 추가할 수 없어요' }, 409);
  const seq = Number(c.req.param('seq'));
  if (!Number.isInteger(seq) || seq < 1 || seq > IMPORT_MAX_IMAGES) return c.json({ error: `이미지는 ${IMPORT_MAX_IMAGES}장까지 올릴 수 있어요` }, 400);
  const body = ImportImageSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'PNG, JPG, WEBP 이미지를 base64로 보내주세요' }, 400);
  const { mime, data } = body.data;
  const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
  if (bytes.length > IMPORT_MAX_IMAGE_BYTES) return c.json({ error: '이미지는 1.5MB 이하로 올려주세요' }, 413);
  if (!isValidImage(bytes, mime)) return c.json({ error: '이미지 파일이 올바르지 않아요' }, 400);
  await repo(c).putImage(job.id, seq, mime, bytes);
  return c.body(null, 204);
});

importsRouter.post('/:id/submit', async (c) => {
  const job = await ownerJob(c);
  if (job instanceof Response) return job;
  // a failed read keeps its images until expiry, so it can be resubmitted
  if (job.status !== 'draft' && job.status !== 'failed') return c.json({ error: '이미 제출한 작업이에요' }, 409);
  if (job.imageCount === 0) return c.json({ error: '이미지를 한 장 이상 올려주세요' }, 400);
  await repo(c).setStatus(job.id, 'queued');
  return c.json(await repo(c).getJob(job.id));
});

importsRouter.post('/:id/apply', async (c) => {
  const job = await ownerJob(c);
  if (job instanceof Response) return job;
  const options = ApplyImportSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!options.success) return c.json({ error: 'Validation error', details: options.error.issues }, 400);
  try {
    await applyResult(repo(c), job, options.data);
    return c.json(await repo(c).getJob(job.id));
  } catch (error) {
    if (error instanceof ImportNotApplicable) return c.json({ error: error.message }, 409);
    return internalError(c, error);
  }
});

importsRouter.post('/:id/discard', async (c) => {
  const job = await ownerJob(c);
  if (job instanceof Response) return job;
  if (job.status === 'applied') return c.json({ error: '이미 반영한 작업이에요' }, 409);
  await repo(c).deleteImages(job.id);
  await repo(c).setStatus(job.id, 'discarded');
  return c.json(await repo(c).getJob(job.id));
});

// ─── Mac OCR worker ───────────────────────────────────────────────────────────

async function workerJob(c: Context<{ Bindings: Env }>): Promise<ImportJob | Response> {
  if (!isWorker(c)) return c.json({ error: 'Forbidden' }, 403);
  const job = await repo(c).getJob(c.req.param('id') ?? '');
  if (!job) return c.json({ error: 'Import not found' }, 404);
  return job.status === 'processing' ? job : c.json({ error: 'Import is not being processed' }, 409);
}

importsRouter.get('/:id/images/:seq', async (c) => {
  const job = await workerJob(c);
  if (job instanceof Response) return job;
  const image = await repo(c).getImage(job.id, Number(c.req.param('seq')));
  if (!image) return c.json({ error: 'Image not found' }, 404);
  return new Response(image.bytes, { headers: { 'Content-Type': image.mime, 'Cache-Control': 'no-store' } });
});

importsRouter.post('/:id/ocr', async (c) => {
  const job = await workerJob(c);
  if (job instanceof Response) return job;
  const submission = OcrSubmissionSchema.safeParse(await c.req.json().catch(() => null));
  if (!submission.success) return c.json({ error: 'Validation error', details: submission.error.issues }, 400);
  try {
    const result = await buildResult(new DBClient(c.env.DB), job, submission.data);
    // the result is recorded before the images go, so a crash cannot lose both
    await repo(c).setStatus(job.id, 'parsed', { result });
    await repo(c).deleteImages(job.id);
    return c.body(null, 204);
  } catch (error) {
    await repo(c).setStatus(job.id, 'failed', { error: '판독 결과를 해석하지 못했어요' });
    return internalError(c, error);
  }
});

importsRouter.post('/:id/fail', async (c) => {
  const job = await workerJob(c);
  if (job instanceof Response) return job;
  const body = FailImportSchema.safeParse(await c.req.json().catch(() => null));
  // images are kept until expiry so a failed read can be retried
  await repo(c).setStatus(job.id, 'failed', { error: body.success ? `OCR 실패: ${body.data.error}` : 'OCR 실패' });
  return c.body(null, 204);
});
