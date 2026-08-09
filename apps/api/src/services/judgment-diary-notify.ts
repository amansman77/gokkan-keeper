import type { JudgmentDiaryEntry } from '@gokkan-keeper/shared';

const ACTION_EMOJI: Record<JudgmentDiaryEntry['action'], string> = {
  BUY: '🟢',
  SELL: '🔴',
  HOLD: '⏸️',
  REBALANCE: '🔄',
  WATCH: '👀',
};

const SITE_URL = 'https://gokkan-keeper.yetimates.com';

export async function notifyJudgmentDiaryPublished(webhookUrl: string, entry: JudgmentDiaryEntry): Promise<void> {
  const payload = {
    embeds: [{
      title: `${ACTION_EMOJI[entry.action]} 판단일지 자동 등록: ${entry.title}`,
      description: entry.summary,
      url: `${SITE_URL}/judgment-diary/${entry.id}`,
      color: 0x3498db,
      footer: { text: `Action: ${entry.action} · 자동화(API_SECRET)로 등록됨` },
      timestamp: entry.createdAt,
    }],
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
