import { useNavigate } from 'react-router-dom';
import { createJudgmentDiaryEntry } from '../lib/api';
import JudgmentDiaryForm from '../components/JudgmentDiaryForm';
import type { CreateJudgmentDiaryEntry } from '../lib/types';

export default function NewJudgmentDiary() {
  const navigate = useNavigate();

  const handleSubmit = async (data: CreateJudgmentDiaryEntry) => {
    const entry = await createJudgmentDiaryEntry(data);
    navigate(`/judgment-diary/${entry.id}`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">새 판단일지</h1>
      <JudgmentDiaryForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/judgment-diary')}
        submitLabel="저장"
        submittingLabel="저장 중..."
      />
    </div>
  );
}
