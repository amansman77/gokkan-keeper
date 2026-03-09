import { useState } from 'react';
import { submitConsultingRequest } from '../../lib/api';
import { trackEvent } from '../../lib/analytics';
import ConcernTextarea from './ConcernTextarea';
import ScreenshotUploadField from './ScreenshotUploadField';
import SubmitSuccessMessage from './SubmitSuccessMessage';

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_SCREENSHOT_SIZE_BYTES = 10 * 1024 * 1024;

interface FormErrors {
  email?: string;
  concern?: string;
  screenshot?: string;
}

function getDeviceType(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') {
    return 'desktop';
  }
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}

function validateForm(email: string, concern: string, screenshot: File | null): FormErrors {
  const errors: FormErrors = {};

  if (!email.trim()) {
    errors.email = '이메일을 입력해 주세요.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = '올바른 이메일 형식을 입력해 주세요.';
  }

  if (!concern.trim()) {
    errors.concern = '현재 고민을 적어 주세요.';
  }

  if (!screenshot) {
    errors.screenshot = '포트폴리오 스크린샷을 올려 주세요.';
  } else if (!ALLOWED_IMAGE_TYPES.has(screenshot.type)) {
    errors.screenshot = 'PNG, JPG, WEBP 이미지 파일만 업로드할 수 있습니다.';
  } else if (screenshot.size > MAX_SCREENSHOT_SIZE_BYTES) {
    errors.screenshot = '이미지 크기는 10MB 이하로 업로드해 주세요.';
  }

  return errors;
}

export default function ConsultingRequestForm() {
  const [email, setEmail] = useState('');
  const [concern, setConcern] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setRequestId(null);

    const nextErrors = validateForm(email, concern, screenshot);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !screenshot) {
      trackEvent('consulting_form_submit_failed', {
        source: typeof window !== 'undefined' ? window.location.pathname : '/consulting',
        device_type: getDeviceType(),
        has_screenshot: !!screenshot,
        concern_length: concern.trim().length,
      });
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.set('email', email.trim());
    formData.set('concern', concern.trim());
    formData.set('sourcePage', typeof window !== 'undefined' ? window.location.pathname : '/consulting');
    formData.set('screenshot', screenshot);

    try {
      const result = await submitConsultingRequest(formData);
      setRequestId(result.requestId);
      setEmail('');
      setConcern('');
      setScreenshot(null);
      setErrors({});
      trackEvent('consulting_form_submitted', {
        source: typeof window !== 'undefined' ? window.location.pathname : '/consulting',
        device_type: getDeviceType(),
        has_screenshot: true,
        concern_length: concern.trim().length,
      });
    } catch (error: any) {
      const message = error.message || '요청 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.';
      setSubmitError(message);
      trackEvent('consulting_form_submit_failed', {
        source: typeof window !== 'undefined' ? window.location.pathname : '/consulting',
        device_type: getDeviceType(),
        has_screenshot: !!screenshot,
        concern_length: concern.trim().length,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleScreenshotChange(file: File | null) {
    setScreenshot(file);
    setErrors((current) => ({ ...current, screenshot: undefined }));

    if (file) {
      trackEvent('consulting_screenshot_uploaded', {
        source: typeof window !== 'undefined' ? window.location.pathname : '/consulting',
        device_type: getDeviceType(),
        has_screenshot: true,
        concern_length: concern.trim().length,
      });
    }
  }

  if (requestId) {
    return <SubmitSuccessMessage requestId={requestId} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6">
        <div>
          <label htmlFor="consulting-email" className="mb-2 block text-sm font-semibold text-slate-800">
            답변 받을 이메일
          </label>
          <input
            id="consulting-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="you@example.com"
          />
          <p className="mt-2 text-sm text-slate-500">검토 후 답변을 받을 메일 주소입니다.</p>
          {errors.email ? <p className="mt-2 text-sm text-rose-700">{errors.email}</p> : null}
        </div>

        <ScreenshotUploadField fileName={screenshot?.name ?? null} error={errors.screenshot} onChange={handleScreenshotChange} />
        <ConcernTextarea value={concern} error={errors.concern} onChange={setConcern} />
      </div>

      {submitError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{submitError}</div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[240px]"
      >
        {loading ? '전송 중...' : '무료 구조 점검 요청 보내기'}
      </button>
    </form>
  );
}
