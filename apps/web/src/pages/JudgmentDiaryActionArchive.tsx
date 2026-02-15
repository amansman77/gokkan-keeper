import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJudgmentDiaryEntries } from '../lib/api';
import type { JudgmentDiaryEntry } from '../lib/types';
import { JUDGMENT_ACTIONS } from '@gokkan-keeper/shared';
import JudgmentDiaryCard from '../components/JudgmentDiaryCard';
import { setSeo } from '../lib/seo';

const actionDescriptions: Record<string, string> = {
  BUY: '매수(BUY) 판단 모음 – 추세 투자자의 매수 기준과 타이밍 기록',
  SELL: '매도(SELL) 판단 모음 – 추세 투자자의 리스크 대응과 청산 기준 기록',
  HOLD: '보유(HOLD) 판단 모음 – 추세를 관찰하며 유지한 판단 기록',
  WATCH: '관망(WATCH) 판단 모음 – 서두르지 않는 태도와 대기 원칙 기록',
  REBALANCE: '리밸런스(REBALANCE) 판단 모음 – 비중 조정 기준과 태도 기록',
};

export default function JudgmentDiaryActionArchive() {
  const { action } = useParams<{ action: string }>();
  const normalizedAction = useMemo(() => (action || '').toUpperCase(), [action]);
  const [entries, setEntries] = useState<JudgmentDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!normalizedAction) return;
    setSeo({
      title: `${normalizedAction} 판단 모음 | 추세 투자자의 판단일지`,
      description:
        actionDescriptions[normalizedAction] ||
        '추세 투자자의 판단일지 아카이브입니다. Action별로 판단의 태도를 모아봅니다.',
    });
  }, [normalizedAction]);

  useEffect(() => {
    async function loadEntries() {
      try {
        setLoading(true);
        setError(null);
        if (!normalizedAction || !JUDGMENT_ACTIONS.includes(normalizedAction as any)) {
          throw new Error('지원하지 않는 Action입니다.');
        }
        const data = await getJudgmentDiaryEntries({ action: normalizedAction as any });
        setEntries(data);
      } catch (err: any) {
        setError(err.message || '판단일지를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadEntries();
  }, [normalizedAction]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{normalizedAction} 판단 모음</h1>
          <p className="text-gray-600">{actionDescriptions[normalizedAction]}</p>
        </div>
        <Link
          to="/judgment-diary"
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          전체 판단일지
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-600">로딩 중...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">{error}</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-500">아직 등록된 판단일지가 없습니다.</div>
      ) : (
        <div className="space-y-6">
          {entries.map((entry) => (
            <JudgmentDiaryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
