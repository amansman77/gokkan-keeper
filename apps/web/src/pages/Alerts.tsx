import { useEffect, useState } from 'react';
import { getAlerts, getPositions, getMarketIndices } from '../lib/api';
import type { AlertLogEntry } from '../lib/api';
import AlertThresholdManager from '../components/AlertThresholdManager';
import WeeklyReportSettings from '../components/WeeklyReportSettings';

const RULE_TITLES: Record<string, string> = {
  SELL_001: '주봉 하락 추세 진입',
  BUY_001: '주봉 상승 추세 진입',
  WARN_003: '장기 추세 이탈',
  SELL_002: '급등 후 차익실현 신호',
};

function ruleTitle(ruleId: string): string {
  if (ruleId.startsWith('FX_')) return '환율 임계값';
  return RULE_TITLES[ruleId] ?? ruleId;
}

function ruleTypeEmoji(ruleId: string): string {
  if (ruleId.startsWith('BUY')) return '🟢';
  if (ruleId.startsWith('SELL')) return '🔴';
  if (ruleId.startsWith('FX')) return '🔔';
  return '⚠️';
}

const PRIORITY_STYLE: Record<string, string> = {
  P0: 'bg-danger-tint text-danger',
  P1: 'bg-flow-tint text-flow',
  P2: 'bg-flow-tint text-flow',
};

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertLogEntry[]>([]);
  const [symbolNames, setSymbolNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAlerts(100), getPositions(), getMarketIndices()])
      .then(([alertsData, positions, marketIndices]) => {
        setAlerts(alertsData);
        const names: Record<string, string> = {};
        for (const p of positions) names[p.symbol] = p.name;
        for (const idx of marketIndices.indices) names[idx.symbol] = idx.name;
        setSymbolNames(names);
      })
      .catch((err) => setError(err.message || '알림 목록을 불러오는데 실패했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="gk-loading">
        <div className="text-ink-muted">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gk-alert">
        <p className="text-danger font-semibold mb-2">오류 발생</p>
        <p className="gk-error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-2">알림</h1>
        <p className="text-ink-muted">알림 트리거를 관리하고, 발송된 알림 이력을 확인합니다</p>
      </div>

      <AlertThresholdManager />
      <WeeklyReportSettings />

      {alerts.length === 0 ? (
        <div className="text-center py-12 text-ink-faint">아직 발송된 알림이 없습니다.</div>
      ) : (
        <div className="bg-surface rounded-lg shadow divide-y divide-line-soft">
          {alerts.map((alert) => (
            <div key={alert.id} className="p-4 flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">{ruleTypeEmoji(alert.ruleId)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${PRIORITY_STYLE[alert.priority] ?? 'bg-surface-2 text-ink-muted'}`}
                  >
                    {alert.priority}
                  </span>
                  <span className="font-medium text-ink">{ruleTitle(alert.ruleId)}</span>
                  <span className="text-sm text-ink-muted">
                    {symbolNames[alert.symbol] ? `${symbolNames[alert.symbol]} ` : ''}
                    <span className="text-ink-faint">({alert.symbol})</span>
                  </span>
                </div>
                {alert.action && <p className="text-sm text-ink-muted mt-1">{alert.action}</p>}
              </div>
              <span className="text-xs text-ink-faint whitespace-nowrap">{alert.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
