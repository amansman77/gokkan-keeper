import {
  ASSET_GOAL_SETTING_KEY,
  parseAssetGoalPlan,
  type AssetGoalPlan
} from '@gokkan-keeper/shared';
import { useEffect, useState } from 'react';
import { getMarketIndices, getSettings, updateSetting } from '../lib/api';
import { GoalEditor } from './asset-goal/GoalEditor';
import { GoalSummary } from './asset-goal/GoalSummary';
import { formatEok, fromDraft, toDraft, totalInKrw, type AssetGoalProgressProps, type DraftPlan } from './asset-goal/model';

export default function AssetGoalProgress({ granaries }: AssetGoalProgressProps) {
  const [plan, setPlan] = useState<AssetGoalPlan | null>(null);
  const [usdKrw, setUsdKrw] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSettings(), getMarketIndices().catch(() => null)])
      .then(([settings, market]) => {
        setPlan(parseAssetGoalPlan(settings[ASSET_GOAL_SETTING_KEY]));
        setUsdKrw(market?.indices.find((index) => index.symbol === 'KRW=X')?.value ?? null);
      })
      .catch((err) => setError((err instanceof Error && err.message) || '목표를 불러오는데 실패했습니다.'));
  }, []);

  if (!plan) {
    return error ? <p className="text-sm text-danger">{error}</p> : null;
  }

  const counted = granaries.filter((g) => !plan.excludedPurposes.includes(g.purpose));
  const { total, excluded } = totalInKrw(counted, usdKrw);
  const hasUsd = counted.some((g) => g.currency === 'USD' && g.latestSnapshot);

  async function savePlan(next: AssetGoalPlan) {
    setSaving(true);
    setError(null);
    try {
      await updateSetting(ASSET_GOAL_SETTING_KEY, JSON.stringify(next));
      setPlan(next);
      setEditing(false);
    } catch (err: unknown) {
      setError((err instanceof Error && err.message) || '목표 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!draft || !plan) return;
    const parsed = fromDraft(draft, plan.baseline);
    if (!parsed.success) {
      setError('입력값을 확인해 주세요. 연도와 금액은 양수여야 합니다.');
      return;
    }
    await savePlan(parsed.data);
  }

  function handleResetBaseline() {
    if (!plan) return;
    const today = new Date().toISOString().slice(0, 10);
    if (!window.confirm(`오늘(${today}) 합계 ${formatEok(total)}원을 경로 기준점으로 저장할까요?`)) return;
    void savePlan({ ...plan, baseline: { date: today, amount: Math.round(total) } });
  }

  return (
    <div className="bg-surface rounded-lg shadow p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink-faint">자산 목표</h2>
        <button
          type="button"
          onClick={() => {
            setDraft(toDraft(plan));
            setEditing(!editing);
            setError(null);
          }}
          className="text-xs text-accent hover:underline"
        >
          {editing ? '닫기' : '목표 수정'}
        </button>
      </div>

      <GoalSummary plan={plan} total={total} hasUsd={hasUsd} usdKrw={usdKrw} excluded={excluded} />

      {editing && draft && <GoalEditor draft={draft} setDraft={setDraft} saving={saving} hasUsd={hasUsd} usdKrw={usdKrw} excluded={excluded} handleSave={handleSave} handleResetBaseline={handleResetBaseline} />}

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
    </div>
  );
}
