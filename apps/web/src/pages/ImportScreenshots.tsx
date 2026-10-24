import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getGranary } from '../lib/api';
import type { GranaryWithLatestSnapshot } from '../lib/types';
import { ImportOutcome } from '../components/screenshot-import/ImportOutcome';
import { ImportReview } from '../components/screenshot-import/ImportReview';
import { ImportUpload } from '../components/screenshot-import/ImportUpload';
import { ImportWaiting } from '../components/screenshot-import/ImportWaiting';
import { useImportJob } from '../components/screenshot-import/useImportJob';

/** Reconcile a granary from broker screenshots (docs/SCREENSHOT_IMPORT.md). */
export default function ImportScreenshots() {
  const { id } = useParams<{ id: string }>();
  const [granary, setGranary] = useState<GranaryWithLatestSnapshot | null>(null);
  const [params, setParams] = useSearchParams();
  const setJobId = useCallback((jobId: string | null) => setParams(jobId ? { job: jobId } : {}, { replace: true }), [setParams]);
  const { job, busy, error, waiting, upload, apply, discard, retry, reset } = useImportJob(id, params.get('job'), setJobId);
  useEffect(() => {
    if (id) getGranary(id).then(setGranary).catch(() => setGranary(null));
  }, [id]);
  const back = `/granaries/${id}`;
  return (
    <div className="gk-narrow gk-stack">
      <div>
        <Link to={back} className="text-sm text-accent hover:underline">← {granary?.name ?? '곳간'}</Link>
        <h1 className="gk-page-title mt-2">스크린샷으로 맞추기</h1>
      </div>
      {error && <div className="gk-alert"><p className="text-danger text-sm">{error}</p></div>}
      {!job && !params.get('job') && <ImportUpload busy={busy} onUpload={(files) => void upload(files)} />}
      {job && waiting && <ImportWaiting job={job} />}
      {job?.status === 'parsed' && <ImportReview job={job} busy={busy} onApply={(o) => void apply(o)} onDiscard={() => void discard()} />}
      {job && ['failed', 'applied', 'discarded'].includes(job.status) && (
        <ImportOutcome job={job} busy={busy} backTo={back} onRetry={() => void retry()} onReset={reset} />
      )}
    </div>
  );
}
