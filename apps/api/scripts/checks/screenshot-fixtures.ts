import type { OcrLine, OcrPage } from '@gokkan-keeper/shared';

/**
 * Synthetic OCR pages laid out like Samsung Securities (mPOP) screens, with the
 * glitches real screenshots showed. Real screenshot data is never committed:
 * this repository is public and those pages carry the owner's holdings.
 */

const W = 1206;
const H = 2622;
const line = (x1: number, y1: number, x2: number, y2: number, text: string): OcrLine => ({ box: [x1, y1, x2, y2], text, conf: 0.99 });

export interface FixtureRow {
  name: string;
  ticker?: string;
  quantity: number | null;
  marketValue: string;
  profitLoss: string;
  percent: string;
}

function chrome(account: string, overseas: boolean): OcrLine[] {
  return [
    line(153, 79, 293, 119, '10:02'),
    ...(overseas ? [line(73, 197, 583, 257, '◇ 해외주식잔고/손익')] : []),
    line(106, 362, 857, 405, `${account} [종합(비대면)] 고객`),
    line(80, 493, 530, 540, overseas ? '잔고 실현손익' : '주식잔고 실현손익'),
    line(904, 492, 1068, 542, '예수금'),
  ];
}

const footer = () => [line(77, 2311, 199, 2343, 'KOSPI'), line(1039, 2309, 1153, 2346, '장종료')];

export function krHoldingsPage(seq: number, account: string, header: string, rows: FixtureRow[], shuffle = false): OcrPage {
  const lines = [
    ...chrome(account, false),
    line(78, 795, 260, 854, '평가손익'), line(511, 782, 1123, 857, header),
    line(567, 1026, 733, 1067, '평가손익'), line(942, 1029, 1102, 1067, '보유수량'),
    line(168, 1072, 287, 1110, '종목명'), line(588, 1113, 707, 1152, '수익률'), line(946, 1111, 1097, 1152, '평가금액'),
    ...rows.flatMap((r, i) => {
      const y = 1200 + i * 185;
      return [
        line(34, y + 17, 197, y + 64, r.name),
        line(645, y + 25, 810, y + 63, r.profitLoss),
        ...(r.quantity === null ? [] : [line(1157, y + 21, 1184, y + 61, String(r.quantity))]),
        line(630, y + 88, 809, y + 122, r.percent),
        line(1013, y + 84, 1184, y + 127, r.marketValue),
      ];
    }),
    ...footer(),
  ];
  // OCR reading order is not row order; boxes are what the parser relies on
  return { seq, width: W, height: H, lines: shuffle ? [...lines].reverse() : lines };
}

export function usHoldingsPage(seq: number, account: string, totals: { profitLoss: string; marketValue: string }, rows: FixtureRow[]): OcrPage {
  return {
    seq, width: W, height: H,
    lines: [
      ...chrome(account, true),
      line(79, 976, 325, 1029, '평가손익'), line(702, 971, 1126, 1035, totals.profitLoss),
      line(80, 1181, 330, 1226, '주식평가금액'), line(849, 1183, 1127, 1222, totals.marketValue),
      line(199, 1384, 313, 1421, '종목명'), line(573, 1383, 727, 1419, '평가손익'), line(947, 1384, 1096, 1421, '보유수량'),
      line(174, 1466, 333, 1502, '종목코드'), line(594, 1467, 707, 1503, '수익률'), line(947, 1465, 1097, 1504, '평가금액'),
      ...rows.flatMap((r, i) => {
        const y = 1550 + i * 185;
        return [
          line(54, y + 3, 269, y + 53, r.name),
          line(645, y + 11, 814, y + 44, r.profitLoss),
          ...(r.quantity === null ? [] : [line(1157, y + 10, 1183, y + 47, String(r.quantity))]),
          line(51, y + 71, 144, y + 108, r.ticker ?? ''),
          line(681, y + 73, 814, y + 106, r.percent),
          line(983, y + 71, 1189, y + 109, r.marketValue),
        ];
      }),
      ...footer(),
    ],
  };
}

export function krCashPage(seq: number, account: string, cash: string): OcrPage {
  return {
    seq, width: W, height: H,
    lines: [
      ...chrome(account, false),
      line(141, 868, 320, 915, '당일현금'), line(598, 860, 1056, 935, cash),
      line(142, 1243, 329, 1286, 'D+2 현금'), line(797, 1240, 1057, 1289, `${cash}원`),
      ...footer(),
    ],
  };
}

export function usCashPage(seq: number, account: string, cash: string): OcrPage {
  return {
    seq, width: W, height: H,
    lines: [
      ...chrome(account, true),
      line(244, 652, 411, 695, '외화잔고'), line(77, 873, 179, 907, 'USD'),
      line(81, 967, 247, 1009, '외화잔고'), line(983, 971, 1127, 1006, cash),
      line(81, 1042, 329, 1084, '원화환산금액'), line(957, 1046, 1127, 1083, '281,662'),
      ...footer(),
    ],
  };
}
