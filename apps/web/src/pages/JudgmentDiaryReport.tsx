import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJudgmentDiaryEntries } from '../lib/api';
import type { JudgmentDiaryEntry } from '../lib/types';
import JudgmentDiaryCard from '../components/JudgmentDiaryCard';
import { setSeo } from '../lib/seo';

function isValidMonth(value?: string) {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

export default function JudgmentDiaryReport() {
  const { month } = useParams<{ month: string }>();
  const [entries, setEntries] = useState<JudgmentDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    if (!month) return '';
    return month.replace('-', '년 ') + '월';
  }, [month]);

  useEffect(() => {
    if (!isValidMonth(month)) return;
    setSeo({
      title: `${monthLabel} 투자 판단 리포트 | 추세 투자자의 판단일지`,
      description: `${monthLabel}에 기록된 판단일지를 모아 태도의 흐름을 요약합니다.`,
    });
  }, [month, monthLabel]);

  useEffect(() => {
    async function loadEntries() {
      try {
        setLoading(true);
        setError(null);
        if (!isValidMonth(month)) {
          throw new Error('유효하지 않은 월 형식입니다.');
        }
        const data = await getJudgmentDiaryEntries({ limit: 500 });
        const filtered = data.filter((item) => item.createdAt.startsWith(`${month}-`));
        setEntries(filtered);
      } catch (err: any) {
        setError(err.message || '판단일지를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadEntries();
  }, [month]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">{monthLabel} 투자 판단 리포트</h1>
        <p className="text-ink-muted">{monthLabel}에 기록된 판단일지를 모아 태도의 흐름을 요약합니다.</p>
      </div>

      {loading ? (
        <div className="text-ink-muted">로딩 중...</div>
      ) : error ? (
        <div className="bg-loss-tint border border-loss rounded-md p-4 text-loss">{error}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-ink-faint">해당 월에 기록이 없습니다.</div>
      ) : (
        <div className="space-y-6">
          {entries.map((entry) => (
            <JudgmentDiaryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      <Link
        to="/judgment-diary"
        className="inline-flex items-center justify-center px-4 py-2 border border-line rounded-md text-ink-muted hover:bg-surface-2"
      >
        전체 판단일지
      </Link>
    </div>
  );
}
