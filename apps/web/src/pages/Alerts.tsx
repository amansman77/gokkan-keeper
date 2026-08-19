import { useEffect, useState } from 'react';
import { getAlerts } from '../lib/api';
import type { AlertLogEntry } from '../lib/api';

const RULE_TITLES: Record<string, string> = {
  SELL_001: '주봉 하락 추세 진입',
  BUY_001: '주봉 상승 추세 진입',
  WARN_003: '장기 추세 이탈',
  SELL_002: '급등 후 차익실현 신호',
  FX_JPY_001: '엔화 환율 임계값',
};

function ruleTitle(ruleId: string): string {
  return RULE_TITLES[ruleId] ?? ruleId;
}

function ruleTypeEmoji(ruleId: string): string {
  if (ruleId.startsWith('BUY')) return '🟢';
  if (ruleId.startsWith('SELL')) return '🔴';
  if (ruleId.startsWith('FX')) return '🔔';
  return '⚠️';
}

const PRIORITY_STYLE: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-yellow-100 text-yellow-700',
};

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAlerts(100)
      .then(setAlerts)
      .catch((err) => setError(err.message || '알림 목록을 불러오는데 실패했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800 font-semibold mb-2">오류 발생</p>
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">알림 이력</h1>
        <p className="text-gray-600">알림 엔진이 발송한 최근 알림입니다 (최대 100건)</p>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">아직 발송된 알림이 없습니다.</div>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
          {alerts.map((alert) => (
            <div key={alert.id} className="p-4 flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">{ruleTypeEmoji(alert.ruleId)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${PRIORITY_STYLE[alert.priority] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {alert.priority}
                  </span>
                  <span className="font-medium text-gray-900">{ruleTitle(alert.ruleId)}</span>
                  <span className="text-sm text-gray-500">{alert.symbol}</span>
                </div>
                {alert.action && <p className="text-sm text-gray-600 mt-1">{alert.action}</p>}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{alert.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
