import { ConsultingRequestSchema, type ConsultingRequestResult } from '@gokkan-keeper/shared';
import type { Env } from '../types';
import { isValidImage } from './image-validation';
import { verifyConsultingChallenge } from './turnstile';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_SCREENSHOT_SIZE_BYTES = 10 * 1024 * 1024;
type FormFieldValue = string | File | null;

export class ConsultingRequestError extends Error {
  constructor(
    message: string,
    public status: 400 | 502 | 503,
  ) {
    super(message);
  }
}

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function isFileLike(value: FormFieldValue): value is File {
  return !!value && typeof value !== 'string' && typeof (value as File).arrayBuffer === 'function';
}

async function getScreenshotFile(formData: FormData): Promise<File> {
  const screenshot = formData.get('screenshot');
  if (!isFileLike(screenshot) || screenshot.size === 0) {
    throw new ConsultingRequestError('포트폴리오 스크린샷을 올려 주세요.', 400);
  }
  if (!ALLOWED_IMAGE_TYPES.has(screenshot.type)) {
    throw new ConsultingRequestError('PNG, JPG, WEBP 이미지 파일만 업로드할 수 있습니다.', 400);
  }
  if (screenshot.size > MAX_SCREENSHOT_SIZE_BYTES) {
    throw new ConsultingRequestError('이미지 크기는 10MB 이하로 업로드해 주세요.', 400);
  }
  if (!isValidImage(new Uint8Array(await screenshot.arrayBuffer()), screenshot.type)) throw new ConsultingRequestError('유효한 PNG, JPG, WEBP 이미지 파일을 올려 주세요.', 400);
  return screenshot;
}

function resolveFileExtension(file: File): string {
  switch (file.type) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

async function sendDiscordNotification(
  webhookUrl: string,
  requestId: string,
  createdAt: string,
  email: string,
  concern: string,
  sourcePage: string | undefined,
  screenshot: File,
): Promise<void> {
  const content = [
    '📩 New Consulting Request',
    `Request ID: ${requestId}`,
    `Created At: ${createdAt}`,
    `Email: ${email}`,
    `Source Page: ${sourcePage || '-'}`,
    '',
    'Concern:',
    concern,
  ].join('\n');

  const payload = new FormData();
  payload.set(
    'payload_json',
    JSON.stringify({
      username: 'Gokkan Keeper', allowed_mentions: { parse: [] },
      content: content.slice(0, 1900),
    }),
  );
  payload.set('files[0]', screenshot, `${requestId}.${resolveFileExtension(screenshot)}`);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    body: payload,
  });

  if (!response.ok) {
    throw new ConsultingRequestError('상담 요청 알림 전송에 실패했습니다.', 502);
  }
}

export async function handleConsultingRequest(env: Env, formData: FormData): Promise<ConsultingRequestResult> {
  if (!env.DISCORD_WEBHOOK_URL) {
    throw new ConsultingRequestError('상담 요청 채널이 아직 준비되지 않았습니다.', 503);
  }

  if (!env.TURNSTILE_SECRET_KEY) throw new ConsultingRequestError('상담 요청 채널이 아직 준비되지 않았습니다.', 503);
  if (formData.get('consent') !== 'true') throw new ConsultingRequestError('상담 요청 정보 전송에 동의해 주세요.', 400);
  if (!await verifyConsultingChallenge(env, getFormValue(formData, 'cf-turnstile-response'))) throw new ConsultingRequestError('보안 확인에 실패했습니다. 다시 확인해 주세요.', 400);
  const screenshot = await getScreenshotFile(formData);
  const payload = ConsultingRequestSchema.parse({
    email: getFormValue(formData, 'email'),
    concern: getFormValue(formData, 'concern'),
    sourcePage: getFormValue(formData, 'sourcePage') || undefined,
  });

  const requestId = `CR-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  await sendDiscordNotification(
    env.DISCORD_WEBHOOK_URL,
    requestId,
    createdAt,
    payload.email,
    payload.concern,
    payload.sourcePage,
    screenshot,
  );

  return { ok: true, requestId };
}
