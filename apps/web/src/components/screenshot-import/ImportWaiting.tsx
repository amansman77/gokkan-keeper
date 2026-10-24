import type { ImportJob } from '@gokkan-keeper/shared';

/** Shown while the Mac OCR job has not reported yet. */
export function ImportWaiting({ job }: { job: ImportJob }) {
  return (
    <div className="gk-card gk-card-pad gk-stack" role="status" aria-live="polite">
      <h2 className="gk-section-heading">{job.status === 'processing' ? '판독 중이에요' : '판독을 기다리는 중이에요'}</h2>
      <p className="gk-hint">
        스크린샷 {job.imageCount}장을 Mac에서 읽고 있어요. 보통 1분 안에 끝나요.
        Mac이 꺼져 있으면 켜질 때 판독하고, 이 화면을 닫아도 작업은 24시간 동안 남아 있어요.
      </p>
    </div>
  );
}
