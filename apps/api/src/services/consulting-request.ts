import { ConsultingRequestSchema, type ConsultingRequestResult } from '@gokkan-keeper/shared';
import type { Env } from '../types';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_SCREENSHOT_SIZE_BYTES = 10 * 1024 * 1024;
type FormFieldValue = string | File | null;

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
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

function getScreenshotFile(formData: FormData): File {
  const screenshot = formData.get('screenshot');
  if (!isFileLike(screenshot) || screenshot.size === 0) {
    throw new HttpError('포트폴리오 스크린샷을 올려 주세요.', 400);
  }
  if (!ALLOWED_IMAGE_TYPES.has(screenshot.type)) {
    throw new HttpError('PNG, JPG, WEBP 이미지 파일만 업로드할 수 있습니다.', 400);
  }
  if (screenshot.size > MAX_SCREENSHOT_SIZE_BYTES) {
    throw new HttpError('이미지 크기는 10MB 이하로 업로드해 주세요.', 400);
  }
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
      username: 'Gokkan Keeper',
      content,
    }),
  );
  payload.set('files[0]', screenshot, screenshot.name || `${requestId}.${resolveFileExtension(screenshot)}`);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    body: payload,
  });

  if (!response.ok) {
    throw new HttpError('상담 요청 알림 전송에 실패했습니다.', 502);
  }
}

export async function handleConsultingRequest(env: Env, formData: FormData): Promise<ConsultingRequestResult> {
  if (!env.DISCORD_WEBHOOK_URL) {
    throw new HttpError('상담 요청 채널이 아직 준비되지 않았습니다.', 503);
  }

  const screenshot = getScreenshotFile(formData);
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
