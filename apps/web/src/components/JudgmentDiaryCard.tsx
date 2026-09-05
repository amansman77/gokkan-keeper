import { Link } from 'react-router-dom';
import type { JudgmentDiaryEntry } from '../lib/types';
import MarkdownContent from './MarkdownContent';

interface JudgmentDiaryCardProps {
  entry: JudgmentDiaryEntry;
}

const actionBadgeClasses: Record<JudgmentDiaryEntry['action'], string> = {
  BUY: 'bg-gain-tint text-gain',
  SELL: 'bg-loss-tint text-loss',
  HOLD: 'bg-closed text-ink-faint',
  WATCH: 'bg-accent-tint text-accent-ink',
  REBALANCE: 'bg-flow-tint text-flow',
};

function summaryClass(text: string) {
  return text.length <= 60 ? 'text-[18px]' : 'text-[17px]';
}

function formatWrittenDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

export default function JudgmentDiaryCard({ entry }: JudgmentDiaryCardProps) {
  return (
    <Link
      to={`/judgment-diary/${entry.id}`}
      className="block bg-surface rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition-shadow p-8 mx-auto"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <h2 className="text-[22px] font-bold leading-snug text-ink">{entry.title}</h2>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${actionBadgeClasses[entry.action]
            }`}
        >
          {entry.action}
        </span>
      </div>
      <p className="mb-4 text-sm text-ink-faint">작성일: {formatWrittenDate(entry.createdAt)}</p>
      <div className={`${summaryClass(entry.summary)} relative bg-surface-2 rounded-xl p-6`}>
        <div className="max-h-[180px] overflow-hidden">
          <MarkdownContent
            content={entry.summary}
            disableLinks
            className="[&_h1]:text-[18px] [&_h2]:text-[17px] [&_h3]:text-[16px] [&_p]:text-ink-muted [&_ul]:text-ink-muted [&_ol]:text-ink-muted"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-2 to-transparent" />
      </div>
    </Link>
  );
}
