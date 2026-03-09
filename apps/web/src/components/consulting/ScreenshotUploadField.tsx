interface ScreenshotUploadFieldProps {
  fileName: string | null;
  error?: string | null;
  onChange: (file: File | null) => void;
}

export default function ScreenshotUploadField({ fileName, error, onChange }: ScreenshotUploadFieldProps) {
  return (
    <div>
      <label htmlFor="consulting-screenshot" className="mb-2 block text-sm font-semibold text-slate-800">
        포트폴리오 스크린샷
      </label>
      <label
        htmlFor="consulting-screenshot"
        className="flex min-h-[156px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center transition hover:border-slate-400 hover:bg-slate-100"
      >
        <span className="text-base font-semibold text-slate-900">
          {fileName ? '다른 이미지로 바꾸기' : '이미지를 눌러 업로드'}
        </span>
        <span className="mt-2 text-sm leading-relaxed text-slate-600">
          증권사 앱 화면, 포트폴리오 현황 화면처럼 현재 구조가 보이는 이미지 1장만 올려 주세요.
        </span>
        <span className="mt-3 text-xs text-slate-500">PNG, JPG, WEBP / 최대 10MB / 민감 정보는 가리고 업로드</span>
        {fileName ? <span className="mt-4 rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700">{fileName}</span> : null}
      </label>
      <input
        id="consulting-screenshot"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
