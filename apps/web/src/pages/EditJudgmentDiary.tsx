import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getJudgmentDiaryEntry, updateJudgmentDiaryEntry } from '../lib/api';
import JudgmentDiaryForm from '../components/JudgmentDiaryForm';
import type { CreateJudgmentDiaryEntry, JudgmentDiaryEntry } from '../lib/types';

export default function EditJudgmentDiary() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<JudgmentDiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEntry() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getJudgmentDiaryEntry(id);
        setEntry(data);
      } catch (err: any) {
        setError(err.message || '판단일지를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadEntry();
  }, [id]);

  const handleSubmit = async (data: CreateJudgmentDiaryEntry) => {
    if (!id) return;
    const { createdAt, ...payload } = data;
    const updated = await updateJudgmentDiaryEntry(id, payload as any);
    navigate(`/judgment-diary/${updated.id}`);
  };

  if (loading) {
    return <div className="text-gray-600">로딩 중...</div>;
  }

  if (error || !entry) {
    return <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">{error || '데이터 없음'}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">판단일지 수정</h1>
      <JudgmentDiaryForm
        initialValue={entry}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/judgment-diary/${entry.id}`)}
        submitLabel="수정"
        submittingLabel="수정 중..."
      />
    </div>
  );
}
