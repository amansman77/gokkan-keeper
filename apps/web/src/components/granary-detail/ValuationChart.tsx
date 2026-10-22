import { formatCurrency } from '@gokkan-keeper/shared';
import { useCallback, useRef, useState } from 'react';
import type { Snapshot } from '../../lib/types';
import Sparkline from '../Sparkline';

interface ValuationChartProps {
  snapshots: Snapshot[];
  currency: string;
}

export function ValuationChart({ snapshots, currency }: ValuationChartProps) {
  const snapshotsAsc = [...snapshots].reverse();
  const [chartWidth, setChartWidth] = useState(720);
  const chartResizeObserverRef = useRef<ResizeObserver | null>(null);

  // The trend chart fills whatever width its card actually has, instead of a fixed size that
  // leaves a large blank gap on wide screens (or forces a scrollbar on narrow ones). A callback
  // ref (rather than useEffect + useRef) because the container only exists once snapshots have
  // loaded — a mount-time effect would run before that div exists and never observe anything.
  const chartContainerRef = useCallback((el: HTMLDivElement | null) => {
    chartResizeObserverRef.current?.disconnect();
    chartResizeObserverRef.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setChartWidth(Math.max(240, Math.floor(width)));
    });
    observer.observe(el);
    chartResizeObserverRef.current = observer;
  }, []);

  return (
    <>
      {snapshotsAsc.length >= 2 && (
        <div className="min-w-0 w-full" ref={chartContainerRef}>
          <Sparkline
            points={snapshotsAsc.map((s) => ({ date: s.date, value: s.totalAmount }))}
            width={chartWidth}
            height={72}
            color="var(--gk-accent)"
            formatValue={(v) => formatCurrency(v, currency)}
          />
        </div>
      )}
    </>
  );
}
