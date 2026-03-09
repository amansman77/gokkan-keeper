interface ConcernTextareaProps {
  value: string;
  error?: string | null;
  onChange: (value: string) => void;
}

export default function ConcernTextarea({ value, error, onChange }: ConcernTextareaProps) {
  return (
    <div>
      <label htmlFor="consulting-concern" className="mb-2 block text-sm font-semibold text-slate-800">
        지금 가장 큰 고민
      </label>
      <textarea
        id="consulting-concern"
        required
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[160px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base leading-relaxed text-slate-900 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        placeholder="예: 현금 비중이 너무 높은지, 미국/한국/현금 비중을 어떻게 잡아야 할지, 지금 구조에서 무엇을 먼저 정리해야 할지 적어 주세요."
      />
      <p className="mt-2 text-sm text-slate-500">길게 정리하지 않아도 됩니다. 지금 머릿속에 있는 고민 그대로 적어 주세요.</p>
      {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
