import { validateLedger, type LedgerRecord } from './ledger';
import { fundPeriodSchema, type FundPeriod } from './types';
import {
  compareTimestamps, FUND_TIMEZONE, parisParts, periodIdSchema, safeMinor,
  timestampFromMillis, timestampSchema, type TimestampValue,
} from './values';

function utcMillis(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  // setUTCFullYear avoids Date.UTC's special interpretation of years 0..99.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}

function parisMonthStart(year: number, month: number): TimestampValue {
  const localMidnight = utcMillis(year, month, 1);
  let candidate = localMidnight;
  // Resolve the timezone offset from Intl/tzdata rather than hard-coding CET/CEST.
  for (let i = 0; i < 4; i++) {
    const parts = parisParts(timestampFromMillis(candidate));
    const representedLocal = utcMillis(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
    const next = candidate + localMidnight - representedLocal;
    if (next === candidate) return timestampFromMillis(candidate);
    candidate = next;
  }
  throw new Error('Unable to resolve Paris month boundary');
}

/** Half-open interval [startsAt, endsAt), with UTC timestamps. */
export function fundPeriodBounds(periodId: string): { startsAt: TimestampValue; endsAt: TimestampValue } {
  periodIdSchema.parse(periodId);
  const [year, month] = periodId.split('-').map(Number);
  return {
    startsAt: parisMonthStart(year, month),
    endsAt: parisMonthStart(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1),
  };
}

/** Full ledger history in, deterministic projection out. No clock, database or external opening balance. */
export function projectFundPeriod(records: readonly LedgerRecord[], periodId: string, calculatedAt: TimestampValue): FundPeriod {
  timestampSchema.parse(calculatedAt);
  const { startsAt, endsAt } = fundPeriodBounds(periodId);
  const entries = validateLedger(records);
  let openingCash = BigInt(0), openingCommitment = BigInt(0);
  let cash = BigInt(0), commitment = BigInt(0);
  const totals = {
    membershipIncomeMinor: BigInt(0), supportIncomeMinor: BigInt(0), feesMinor: BigInt(0), refundsMinor: BigInt(0),
    newCommitmentsMinor: BigInt(0), releasedCommitmentsMinor: BigInt(0), payoutsMinor: BigInt(0),
    cashAdjustmentsMinor: BigInt(0), commitmentAdjustmentsMinor: BigInt(0),
  };
  for (const { entry } of entries) {
    if (compareTimestamps(entry.effectiveAt, endsAt) >= 0) continue;
    cash += BigInt(entry.cashDeltaMinor);
    commitment += BigInt(entry.commitmentDeltaMinor);
    if (compareTimestamps(entry.effectiveAt, startsAt) < 0) {
      openingCash += BigInt(entry.cashDeltaMinor);
      openingCommitment += BigInt(entry.commitmentDeltaMinor);
      continue;
    }
    const amount = BigInt(entry.amountMinor);
    switch (entry.operationType) {
      case 'membership_payment': totals.membershipIncomeMinor += amount; break;
      case 'extra_support': totals.supportIncomeMinor += amount; break;
      case 'payment_fee': totals.feesMinor += amount; break;
      case 'refund': totals.refundsMinor += amount; break;
      case 'project_commitment': totals.newCommitmentsMinor += amount; break;
      case 'project_commitment_release': totals.releasedCommitmentsMinor += amount; break;
      case 'project_payout': totals.payoutsMinor += amount; break;
      case 'manual_adjustment':
        totals.cashAdjustmentsMinor += BigInt(entry.cashDeltaMinor);
        totals.commitmentAdjustmentsMinor += BigInt(entry.commitmentDeltaMinor);
        break;
    }
  }
  return fundPeriodSchema.parse({
    schemaVersion: 1, periodId, timezone: FUND_TIMEZONE, startsAt, endsAt, calculatedAt,
    ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, safeMinor(value)])),
    openingCashMinor: safeMinor(openingCash), closingCashMinor: safeMinor(cash),
    openingCommitmentMinor: safeMinor(openingCommitment), closingCommitmentMinor: safeMinor(commitment),
    availableMinor: safeMinor(cash - commitment),
  });
}
