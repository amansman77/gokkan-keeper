import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJudgmentDiaryEntries } from '../lib/api';
import type { JudgmentDiaryEntry } from '../lib/types';
import { JUDGMENT_ACTIONS } from '@gokkan-keeper/shared';
import JudgmentDiaryCard from '../components/JudgmentDiaryCard';
import { setSeo } from '../lib/seo';

export default function JudgmentDiaryList() {
  const [entries, setEntries] = useState<JudgmentDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');

  useEffect(() => {
    async function loadEntries() {
      try {
        setLoading(true);
        setError(null);
        const data = await getJudgmentDiaryEntries({
          action: action || undefined,
        });
        setEntries(data);
      } catch (err: any) {
        setError(err.message || '판단일지를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadEntries();
  }, [action]);
  useEffect(() => {
    setSeo({
      title: '추세 투자자의 판단일지 – 시장을 대하는 태도 기록',
      description:
        '이곳은 추세 투자자가 시장을 대하는 태도를 기록하는 판단일지 아카이브입니다. 매수·매도 같은 이벤트보다 판단의 맥락과 태도를 더 중요하게 기록합니다. 각 카드에는 제목과 한 줄 판단만 남겨서 철학이 먼저 읽히게 했습니다. 판단을 쌓아가며 반복되는 원칙을 발견하고, 행동보다 태도 중심의 투자 기록을 만들기 위해 설계되었습니다.',
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">판단일지</h1>
          <p className="text-gray-600">
            추세 투자자가 시장을 대하는 태도를 기록하는 아카이브입니다.
            <br />
            매수·매도라는 결과보다 그 판단을 만든 철학과 태도가 먼저 읽히도록 구성했습니다.
            <br />
            제목과 한 줄 판단을 중심으로 기록하여, 반복되는 원칙을 스스로 확인하고 축적하는 데 목적이 있습니다.
          </p>
        </div>
        <Link
          to="/judgment-diary/new"
          className="inline-flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          새 판단일지
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-4 grid grid-cols-1 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">전체</option>
            {JUDGMENT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
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
