import { useCallback, useEffect, useState } from 'react';
import type { ApplyImport, ImportJob } from '@gokkan-keeper/shared';
import { applyImport, createImport, discardImport, getImport, submitImport, uploadImportImage } from '../../lib/api';
import { encodeScreenshot } from './encode';

const POLL_MS = 3000;
const message = (error: unknown, fallback: string) => (error instanceof Error && error.message) || fallback;

/** Drives one screenshot import: upload → wait for the Mac OCR job → review → apply. */
export function useImportJob(granaryId: string | undefined) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [granaryId]);

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
    reset: () => { setJob(null); setError(null); },
  };
}
