import 'server-only';
import type { LedgerEntry } from '../../finance/ledger';
import { projectFundPeriod } from '../../finance/periods';
import { fundPeriodSchema, type FundPeriod } from '../../finance/types';
import { safeMinor, type TimestampValue } from '../../finance/values';

export const periodTimestampFields = ['startsAt', 'endsAt', 'calculatedAt'] as const;

export function addMinor(a: number, b: number) { return safeMinor(BigInt(a) + BigInt(b)); }

/** Increment only M's categories; later periods receive opening/closing deltas. */
export function applyPeriodEntry(period: FundPeriod, entry: LedgerEntry, now: TimestampValue): FundPeriod {
  const next = { ...period, calculatedAt: now };
  if (period.periodId === entry.periodId) {
    const category = {
      membership_payment: 'membershipIncomeMinor', extra_support: 'supportIncomeMinor',
      payment_fee: 'feesMinor', refund: 'refundsMinor', project_commitment: 'newCommitmentsMinor',
      project_commitment_release: 'releasedCommitmentsMinor', project_payout: 'payoutsMinor',
    } as const;
    if (entry.operationType === 'manual_adjustment') {
      next.cashAdjustmentsMinor = addMinor(next.cashAdjustmentsMinor, entry.cashDeltaMinor);
      next.commitmentAdjustmentsMinor = addMinor(next.commitmentAdjustmentsMinor, entry.commitmentDeltaMinor);
    } else {
      const field = category[entry.operationType];
      next[field] = addMinor(next[field], entry.amountMinor);
    }
  } else {
    next.openingCashMinor = addMinor(next.openingCashMinor, entry.cashDeltaMinor);
    next.openingCommitmentMinor = addMinor(next.openingCommitmentMinor, entry.commitmentDeltaMinor);
  }
  next.closingCashMinor = addMinor(next.closingCashMinor, entry.cashDeltaMinor);
  next.closingCommitmentMinor = addMinor(next.closingCommitmentMinor, entry.commitmentDeltaMinor);
  next.availableMinor = safeMinor(BigInt(next.closingCashMinor) - BigInt(next.closingCommitmentMinor));
  return fundPeriodSchema.parse(next);
}

export function emptyPeriod(periodId: string, previous: FundPeriod | undefined, now: TimestampValue): FundPeriod {
  const zero = projectFundPeriod([], periodId, now);
  return fundPeriodSchema.parse({ ...zero,
    openingCashMinor: previous?.closingCashMinor ?? 0, closingCashMinor: previous?.closingCashMinor ?? 0,
    openingCommitmentMinor: previous?.closingCommitmentMinor ?? 0, closingCommitmentMinor: previous?.closingCommitmentMinor ?? 0,
    availableMinor: previous?.availableMinor ?? 0,
  });
}
