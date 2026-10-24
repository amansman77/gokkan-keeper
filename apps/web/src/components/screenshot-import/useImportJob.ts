import { useCallback, useEffect, useState } from 'react';
import type { ApplyImport, ImportJob } from '@gokkan-keeper/shared';
import { applyImport, createImport, discardImport, getImport, submitImport, uploadImportImage } from '../../lib/api';
import { encodeScreenshot } from './encode';

const POLL_MS = 3000;
const message = (error: unknown, fallback: string) => (error instanceof Error && error.message) || fallback;

/**
 * Drives one screenshot import: upload → wait for the Mac OCR job → review →
 * apply. The job id lives in the URL (`?job=`), so a refresh or a return later
 * — the job survives 24h while the Mac is off — reopens the same job.
 */
export function useImportJob(granaryId: string | undefined, jobId: string | null, onJobId: (id: string | null) => void) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || job?.id === jobId) return;
    getImport(jobId).then((loaded) => (loaded.granaryId === granaryId ? setJob(loaded) : onJobId(null)))
      .catch(() => onJobId(null)); // expired or unknown: start over
  }, [jobId, job?.id, granaryId, onJobId]);

  const waiting = job?.status === 'queued' || job?.status === 'processing';
  useEffect(() => {
    if (!job || !waiting) return;
    const timer = setInterval(() => {
      getImport(job.id).then(setJob).catch((e: unknown) => setError(message(e, '판독 상태를 불러오지 못했어요')));
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [job, waiting]);

  const upload = useCallback(async (files: File[]) => {
    if (!granaryId || files.length === 0) return;
    setError(null);
    try {
      setBusy('작업을 만드는 중…');
      const created = await createImport(granaryId);
      onJobId(created.id);
      for (const [index, file] of files.entries()) {
        setBusy(`스크린샷 올리는 중… (${index + 1}/${files.length})`);
        await uploadImportImage(created.id, index + 1, await encodeScreenshot(file));
      }
      setJob(await submitImport(created.id));
    } catch (e: unknown) {
      setError(message(e, '스크린샷을 올리지 못했어요'));
    } finally {
      setBusy(null);
    }
  }, [granaryId, onJobId]);

  const run = useCallback(async (label: string, action: () => Promise<ImportJob>) => {
    setError(null);
    setBusy(label);
    try {
      setJob(await action());
    } catch (e: unknown) {
      setError(message(e, '요청을 처리하지 못했어요'));
    } finally {
      setBusy(null);
    }
  }, []);

  return {
    job, busy, error, waiting, upload,
    apply: (options: ApplyImport) => job && run('반영하는 중…', () => applyImport(job.id, options)),
    discard: () => job && run('취소하는 중…', () => discardImport(job.id)),
    retry: () => job && run('다시 제출하는 중…', () => submitImport(job.id)),
    reset: () => { setJob(null); setError(null); onJobId(null); },
  };
}
