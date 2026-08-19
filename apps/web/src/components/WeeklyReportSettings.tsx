import { useEffect, useState } from 'react';
import { getSettings, updateSetting } from '../lib/api';

const OVERBOUGHT_KEY = 'weekly_report_rsi_overbought';
const OVERSOLD_KEY = 'weekly_report_rsi_oversold';

export default function WeeklyReportSettings() {
  const [overbought, setOverbought] = useState('');
  const [oversold, setOversold] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        setOverbought(settings[OVERBOUGHT_KEY] ?? '70');
        setOversold(settings[OVERSOLD_KEY] ?? '30');
      })
      .catch((err) => setError(err.message || '설정을 불러오는데 실패했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await Promise.all([
        updateSetting(OVERBOUGHT_KEY, overbought),
        updateSetting(OVERSOLD_KEY, oversold),
      ]);
      setSaved(true);
    } catch (err: any) {
      setError(err.message || '설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">주간 후보군 리포트 설정</h2>
        <div className="text-sm text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-sm font-semibold text-gray-500 mb-3">주간 후보군 리포트 설정</h2>
      <p className="text-xs text-gray-400 mb-4">
        매주 토요일 발행되는 후보군 지표 리포트에서 RSI 과매수/과매도로 언급할 기준값입니다.
      </p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">RSI 과매수 기준</label>
          <input
            type="number"
            step="any"
            value={overbought}
            onChange={(e) => { setOverbought(e.target.value); setSaved(false); }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-24"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-gray-500 mb-1">RSI 과매도 기준</label>
          <input
            type="number"
            step="any"
            value={oversold}
            onChange={(e) => { setOversold(e.target.value); setSaved(false); }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-24"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        {saved && <span className="text-sm text-emerald-600">저장됨</span>}
      </form>
    </div>
  );
}
