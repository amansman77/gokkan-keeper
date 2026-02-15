import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJudgmentDiaryEntries } from '../lib/api';
import type { JudgmentDiaryEntry } from '../lib/types';
import { setSeo } from '../lib/seo';

export default function JudgmentDiaryPrinciples() {
  const [entries, setEntries] = useState<JudgmentDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeo({
      title: '내가 반복하는 투자 원칙 15가지 | 추세 투자자의 판단일지',
      description:
        '판단일지에서 반복되는 한 줄 판단을 모아 투자 원칙을 정리합니다. 태도 중심의 투자 기록을 통해 나의 기준을 확인합니다.',
    });
  }, []);

  useEffect(() => {
    async function loadEntries() {
      try {
        setLoading(true);
        setError(null);
        const data = await getJudgmentDiaryEntries({ limit: 200 });
        setEntries(data);
      } catch (err: any) {
        setError(err.message || '판단일지를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadEntries();
  }, []);

  const principles = useMemo(() => {
    const unique = new Set<string>();
    const result: string[] = [];
    for (const entry of entries) {
      if (result.length >= 15) break;
      const text = entry.summary.trim();
      if (!text || unique.has(text)) continue;
      unique.add(text);
      result.push(text);
    }
    return result;
  }, [entries]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">내가 반복하는 투자 원칙 15가지</h1>
        <p className="text-gray-600">
          판단일지에서 반복되는 한 줄 판단을 모아 나의 투자 원칙을 정리합니다. 아직은 단순 추출이지만,
          누적될수록 태도의 패턴이 더 선명해집니다.
        </p>
      </div>

      {loading ? (
        <div className="text-gray-600">로딩 중...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">{error}</div>
      ) : principles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">아직 정리할 원칙이 없습니다.</div>
      ) : (
        <ol className="list-decimal list-inside space-y-3 text-gray-800">
          {principles.map((item) => (
            <li key={item} className="text-lg">
              {item}
            </li>
          ))}
        </ol>
      )}

      <Link
        to="/judgment-diary"
        className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
      >
        전체 판단일지
      </Link>
    </div>
  );
}
