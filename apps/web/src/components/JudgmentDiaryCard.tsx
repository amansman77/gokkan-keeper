import { Link } from 'react-router-dom';
import type { JudgmentDiaryEntry } from '../lib/types';
import { slugify } from '../lib/slug';
import MarkdownContent from './MarkdownContent';

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
      <div className={`${summaryClass(entry.summary)} relative bg-[#f8f9fb] rounded-xl p-6`}>
        <div className="max-h-[180px] overflow-hidden">
          <MarkdownContent
            content={entry.summary}
            disableLinks
            className="[&_h1]:text-[18px] [&_h2]:text-[17px] [&_h3]:text-[16px] [&_p]:text-[#444] [&_ul]:text-[#444] [&_ol]:text-[#444]"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#f8f9fb] to-transparent" />
      </div>
    </Link>
  );
}
