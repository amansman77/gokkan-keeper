import { z } from 'zod';

/**
 * Screenshot import (스크린샷 판독): broker screenshots are read by a local OCR
 * job on the owner's Mac, parsed and checked by the API, then applied to a
 * granary only after the owner reviews them. See docs/SCREENSHOT_IMPORT.md.
 */

export const IMPORT_MAX_IMAGES = 12;
export const IMPORT_MAX_IMAGE_BYTES = 1_572_864;
export const IMPORT_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const IMPORT_JOB_STATUSES = ['draft', 'queued', 'processing', 'parsed', 'failed', 'applied', 'discarded'] as const;
export type ImportJobStatus = typeof IMPORT_JOB_STATUSES[number];

/** One OCR text line as the Mac job reports it: pixel box [x1, y1, x2, y2]. */
export const OcrLineSchema = z.object({
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  text: z.string().max(500),
  conf: z.number().min(0).max(1),
});

export const OcrPageSchema = z.object({
  seq: z.number().int().min(1).max(IMPORT_MAX_IMAGES),
  width: z.number().int().positive().max(10_000),
  height: z.number().int().positive().max(20_000),
  lines: z.array(OcrLineSchema).max(600),
});

export const OcrSubmissionSchema = z.object({
  pages: z.array(OcrPageSchema).min(1).max(IMPORT_MAX_IMAGES),
});

export type OcrLine = z.infer<typeof OcrLineSchema>;
export type OcrPage = z.infer<typeof OcrPageSchema>;
export type OcrSubmission = z.infer<typeof OcrSubmissionSchema>;

export type ImportScreenKind = 'kr-holdings' | 'us-holdings' | 'kr-cash' | 'us-cash' | 'unknown';

/** A holding row read from one or more screenshots. */
export interface ImportedHolding {
  name: string;
  /** Overseas ticker as printed; domestic screens show names only. */
  ticker: string | null;
  quantity: number;
  marketValue: number;
  profitLoss: number;
  profitLossPercent: number | null;
  /** (marketValue − profitLoss) ÷ quantity, as the broker prices it. */
  avgCost: number;
  pages: number[];
}

export type ImportCheckCode = 'profit_loss_total' | 'market_value_total' | 'account' | 'cash_present';

export interface ImportCheck {
  code: ImportCheckCode;
  passed: boolean;
  detail: string;
}

export type ImportWarningCode = 'unexplained_cash' | 'missing_position' | 'new_holding' | 'ignored_pages' | 'repaired_number' | 'ambiguous_match';

export interface ImportWarning {
  code: ImportWarningCode;
  detail: string;
}

export interface ImportPositionChange {
  positionId: string;
  name: string;
  holding: ImportedHolding;
  before: { quantity: number | null; avgCost: number | null };
  after: { quantity: number; avgCost: number };
}

export interface ImportSymbolSuggestion {
  symbol: string;
  name: string;
  market: string | null;
  assetType: string | null;
}

export interface ImportProposal {
  changes: ImportPositionChange[];
  unchanged: number;
  /** Holdings with no matching position. `suggestion` is a same-name position
   *  in another granary, so the symbol a domestic screen never prints can be
   *  proposed; without one the owner registers the holding by hand. */
  newHoldings: { holding: ImportedHolding; suggestion: ImportSymbolSuggestion | null }[];
  /** Positions held in the granary but absent from every screenshot. */
  missingPositions: { positionId: string; name: string; quantity: number }[];
  snapshot: { date: string; totalAmount: number; availableBalance: number; profitLoss: number; marketValue: number };
}

export interface ImportResult {
  currency: 'KRW' | 'USD';
  accountSuffix: string | null;
  holdings: ImportedHolding[];
  cash: number | null;
  totals: { profitLoss: number | null; marketValue: number | null };
  checks: ImportCheck[];
  warnings: ImportWarning[];
  proposal: ImportProposal | null;
}

export interface ImportJob {
  id: string;
  granaryId: string;
  status: ImportJobStatus;
  imageCount: number;
  result: ImportResult | null;
  error: string | null;
  linkedAccountSuffix: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export const ApplyImportSchema = z.object({
  /** Set positions missing from every screenshot to quantity 0 (sold). */
  zeroMissing: z.boolean().optional(),
  /** Indexes into `proposal.newHoldings` to register using their suggestion. */
  createNew: z.array(z.number().int().min(0).max(200)).max(200).optional(),
});
export type ApplyImport = z.infer<typeof ApplyImportSchema>;

export const CreateImportSchema = z.object({ granaryId: z.string().uuid() });
/** Images travel as base64 JSON: the API accepts only JSON bodies from browsers. */
export const ImportImageSchema = z.object({
  mime: z.enum(IMPORT_IMAGE_MIMES),
  data: z.string().min(1).max(Math.ceil(IMPORT_MAX_IMAGE_BYTES / 3) * 4).regex(/^[A-Za-z0-9+/]+={0,2}$/),
});
export const FailImportSchema = z.object({ error: z.string().max(300) });
