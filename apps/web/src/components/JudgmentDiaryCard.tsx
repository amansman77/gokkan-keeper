import { Link } from 'react-router-dom';
import type { JudgmentDiaryEntry } from '../lib/types';
import { slugify } from '../lib/slug';

interface JudgmentDiaryCardProps {
  entry: JudgmentDiaryEntry;
}

const actionBadgeClasses: Record<JudgmentDiaryEntry['action'], string> = {
  BUY: 'bg-[#e6f7ee] text-[#1e7f4f]',
  SELL: 'bg-[#fdecea] text-[#b42318]',
  HOLD: 'bg-[#f2f4f7] text-[#667085]',
  WATCH: 'bg-[#e7f0ff] text-[#175cd3]',
  REBALANCE: 'bg-[#f3e8ff] text-[#7a5af8]',
};

function truncateSummary(text: string) {
  if (text.length <= 120) return text;
  return `${text.slice(0, 120)}…`;
}

function summaryClass(text: string) {
  return text.length <= 60 ? 'text-[18px]' : 'text-[17px]';
}

export default function JudgmentDiaryCard({ entry }: JudgmentDiaryCardProps) {
  const slug = slugify(entry.title);

  return (
    <Link
      to={`/judgment-diary/${slug}`}
      className="block bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition-shadow p-8 mx-auto"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <h2 className="text-[22px] font-bold leading-snug text-gray-900">{entry.title}</h2>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${actionBadgeClasses[entry.action]
            }`}
        >
          {entry.action}
        </span>
      </div>
      <div
        className={`${summaryClass(entry.summary)} leading-[1.8] text-[#444] bg-[#f8f9fb] rounded-xl p-6`}
      >
        {truncateSummary(entry.summary)}
      </div>
    </Link>
  );
}
