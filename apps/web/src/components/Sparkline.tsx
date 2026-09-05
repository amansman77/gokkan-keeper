import { useMemo, useState } from 'react';
import type { WeeklyPoint } from '../lib/api';

interface SparklineProps {
  points: WeeklyPoint[];
  width?: number;
  height?: number;
  color: string;
  formatValue: (value: number) => string;
}

export default function Sparkline({ points, width = 72, height = 24, color, formatValue }: SparklineProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { path, coords, min, max } = useMemo(() => {
    if (points.length < 2) return { path: '', coords: [] as { x: number; y: number }[], min: 0, max: 0 };
    const values = points.map((p) => p.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const range = hi - lo || 1;
    const padY = 2;
    const stepX = width / (points.length - 1);

    const pts = values.map((v, i) => ({
      x: i * stepX,
      y: padY + (1 - (v - lo) / range) * (height - padY * 2),
    }));

    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return { path: d, coords: pts, min: lo, max: hi };
  }, [points, width, height]);

  if (points.length < 2) {
    return <div className="text-xs text-gray-300" style={{ width, height }} />;
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const hoveredCoord = hoverIndex !== null ? coords[hoverIndex] : null;

  function updateHoverFromClientX(container: Element, clientX: number) {
    const rect = container.getBoundingClientRect();
    const relX = clientX - rect.left;
    const stepX = width / (points.length - 1);
    const idx = Math.min(points.length - 1, Math.max(0, Math.round(relX / stepX)));
    setHoverIndex(idx);
  }

  return (
    <div className="relative inline-block" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible touch-none"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => updateHoverFromClientX(e.currentTarget, e.clientX)}
        onTouchStart={(e) => updateHoverFromClientX(e.currentTarget, e.touches[0].clientX)}
        onTouchMove={(e) => updateHoverFromClientX(e.currentTarget, e.touches[0].clientX)}
        onTouchEnd={() => setHoverIndex(null)}
      >
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {hoveredCoord && (
          <>
            <line x1={hoveredCoord.x} y1={0} x2={hoveredCoord.x} y2={height} stroke={color} strokeWidth={1} strokeOpacity={0.25} />
            <circle cx={hoveredCoord.x} cy={hoveredCoord.y} r={2.5} fill={color} stroke="white" strokeWidth={1} />
          </>
        )}
      </svg>
      {hovered && hoveredCoord && (
        <div
          className="absolute z-10 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white shadow"
          style={{
            left: Math.min(Math.max(hoveredCoord.x, 20), width - 20),
            top: -22,
          }}
        >
          {hovered.date} · {formatValue(hovered.value)}
        </div>
      )}
      <span className="sr-only">
        최근 {points.length}주 추이: {formatValue(min)} ~ {formatValue(max)}
      </span>
    </div>
  );
}
