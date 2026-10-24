import type { ApplyImport, ImportJob, ImportProposal, ImportResult, OcrSubmission, Position } from '@gokkan-keeper/shared';
import type { DBClient } from '../../db/client';
import type { ImportRepository } from '../../db/repositories/import-repository';
import { mergePages } from './merge';
import { reconcile } from './reconcile';

/**
 * Orchestration for screenshot imports: turns the Mac worker's OCR output into
 * a checked proposal, and applies an approved proposal through the existing
 * repositories. Parsing and checking stay pure (see merge/reconcile).
 */

const kstDate = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export async function buildResult(db: DBClient, job: ImportJob, submission: OcrSubmission): Promise<ImportResult> {
  const granary = await db.getGranaryById(job.granaryId);
  if (!granary) throw new Error('Granary not found');
  if (granary.currency !== 'KRW' && granary.currency !== 'USD') throw new Error('Only KRW and USD granaries can import screenshots');
  const [all, lastSnapshot, flows] = await Promise.all([
    db.getPositions(), db.getLatestSnapshotByGranaryId(job.granaryId), db.getCashFlowsByGranaryId(job.granaryId),
  ]);
  const date = kstDate(job.createdAt);
  // a snapshot already taken today is what this import replaces, not its baseline
  const baseline = lastSnapshot && lastSnapshot.date < date ? lastSnapshot : await previousBefore(db, job.granaryId, date);
  return reconcile({
    reading: mergePages(submission.pages, granary.currency),
    positions: all.filter((p) => p.granaryId === job.granaryId),
    otherPositions: all.filter((p) => p.granaryId !== job.granaryId),
    lastSnapshot: baseline,
    flowsSinceLastSnapshot: flows.filter((f) => (!baseline || f.date > baseline.date) && f.date <= date),
    linkedAccountSuffix: job.linkedAccountSuffix,
    date,
  });
}

async function previousBefore(db: DBClient, granaryId: string, date: string) {
  return (await db.getSnapshotsByGranaryId(granaryId, 5)).find((s) => s.date < date) ?? null;
}

export class ImportNotApplicable extends Error {}

export async function applyResult(db: DBClient, imports: ImportRepository, job: ImportJob, options: ApplyImport): Promise<void> {
  const result = job.result;
  const proposal = result?.proposal;
  if (job.status !== 'parsed' || !result || !proposal) throw new ImportNotApplicable('판독이 끝난 작업만 반영할 수 있어요');
  const failed = result.checks.filter((c) => !c.passed);
  if (failed.length) throw new ImportNotApplicable(`검증을 통과하지 못했어요: ${failed.map((c) => c.detail).join(' / ')}`);

  for (const change of proposal.changes) await db.updatePosition(change.positionId, change.after);
  for (const index of options.createNew ?? []) await createNew(db, job.granaryId, proposal.newHoldings[index], result.currency);
  if (options.zeroMissing) for (const m of proposal.missingPositions) await db.updatePosition(m.positionId, { quantity: 0 });

  const { snapshot } = proposal;
  const memo = `스크린샷 판독 (주식 평가금액 ${snapshot.marketValue.toLocaleString('ko-KR')})`;
  const fields = { totalAmount: snapshot.totalAmount, availableBalance: snapshot.availableBalance, profitLoss: snapshot.profitLoss, memo };
  const sameDay = (await db.getSnapshotsByGranaryId(job.granaryId, 5)).find((s) => s.date === snapshot.date);
  if (sameDay) await db.updateSnapshot(sameDay.id, fields);
  else await db.createSnapshot({ granaryId: job.granaryId, date: snapshot.date, ...fields });

  if (result.accountSuffix) await imports.linkAccount(job.granaryId, result.accountSuffix);
  await imports.setStatus(job.id, 'applied');
}

type NewHolding = ImportProposal['newHoldings'][number];

async function createNew(db: DBClient, granaryId: string, entry: NewHolding | undefined, currency: 'KRW' | 'USD'): Promise<Position | null> {
  if (!entry?.suggestion) return null;
  const { holding, suggestion } = entry;
  return db.createPosition({
    granaryId, name: suggestion.name, symbol: suggestion.symbol, market: suggestion.market, assetType: suggestion.assetType,
    quantity: holding.quantity, avgCost: Math.round(holding.avgCost * (currency === 'KRW' ? 1 : 10_000)) / (currency === 'KRW' ? 1 : 10_000),
    priceCurrency: currency, isPublic: false, publicOrder: 0,
  });
}
