import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getJudgmentDiaryEntries, getJudgmentDiaryEntry } from '../lib/api';
import type { JudgmentDiaryEntry } from '../lib/types';
import { isUuid, slugify } from '../lib/slug';
import { setSeo } from '../lib/seo';

export default function JudgmentDiaryDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [entry, setEntry] = useState<JudgmentDiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEntry() {
      if (!slug) return;
      try {
        setLoading(true);
        setError(null);
        if (isUuid(slug)) {
          const data = await getJudgmentDiaryEntry(slug);
          setEntry(data);
          return;
        }

        const entries = await getJudgmentDiaryEntries({ limit: 200 });
        const matched = entries.find((item) => slugify(item.title) === slug);
        if (!matched) {
          throw new Error('판단일지를 찾을 수 없습니다.');
        }
        const data = await getJudgmentDiaryEntry(matched.id);
        setEntry(data);
      } catch (err: any) {
        setError(err.message || '판단일지를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadEntry();
  }, [slug]);

  useEffect(() => {
    if (!entry) return;
    setSeo({
      title: `${entry.title} | 추세 투자자의 판단일지`,
      description: `${entry.summary}. 추세 투자자가 시장을 대하는 태도를 기록한 판단일지입니다.`,
    });
  }, [entry]);

  if (loading) {
    return <div className="text-gray-600">로딩 중...</div>;
  }

  if (error || !entry) {
    return <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">{error || '데이터 없음'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{entry.title}</h1>
        </div>
        <Link
          to={`/judgment-diary/${entry.id}/edit`}
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          수정
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">한 줄 판단</h2>
          <p className="text-gray-700 whitespace-pre-line">{entry.summary}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Action</h2>
          <div className="text-gray-700">{entry.action}</div>
        </section>

        {entry.disclaimerVisible && (
          <section className="border-t pt-6 text-sm text-gray-500 space-y-1">
            <p>본 기록은 개인의 판단 과정을 정리한 것이며 투자 권유가 아닙니다.</p>
            <p>모든 투자의 책임은 본인에게 있습니다.</p>
          </section>
        )}
      </div>
    </div>
  );
}
