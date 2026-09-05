import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export default function GranaryAddMenu({ granaryId }: { granaryId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        aria-label="기록 추가"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="granary-add-menu"
        onClick={() => {
          dialogRef.current?.showModal();
          setOpen(true);
        }}
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-md hover:bg-accent-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        id="granary-add-menu"
        aria-labelledby="granary-add-title"
        onClose={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const items = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]');
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
        }}
        className="granary-add-sheet fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-ink shadow-md"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="granary-add-title" className="text-lg font-semibold">기록 추가</h2>
          <button type="button" autoFocus onClick={close} aria-label="기록 추가 메뉴 닫기" className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="space-y-3">
          <Link to={`/snapshots/new?granaryId=${granaryId}`} onClick={close} className="block rounded-lg border border-line p-4 hover:bg-accent-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <span className="block font-semibold text-accent">스냅샷 추가</span>
            <span className="mt-1 block text-sm text-ink-muted">특정 날짜의 곳간 평가금액을 기록합니다.</span>
          </Link>
          <Link to={`/positions/new?granaryId=${granaryId}`} onClick={close} className="block rounded-lg border border-line p-4 hover:bg-accent-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <span className="block font-semibold text-accent">포지션 추가</span>
            <span className="mt-1 block text-sm text-ink-muted">이 곳간에 보유 자산을 추가합니다.</span>
          </Link>
        </div>
      </dialog>
    </>
  );
}
