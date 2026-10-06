import { expect, it } from 'vitest';
import { createLedgerEntry, createReversal, type LedgerEntryInput, type LedgerRecord } from './ledger';
import { fundPeriodBounds, projectFundPeriod } from './periods';
import { fundPeriodSchema } from './types';
import { periodIdFor, timestampFromMillis } from './values';

const ts = (iso: string) => timestampFromMillis(Date.parse(iso));
const calculatedAt = ts('2026-12-01T12:00:00Z');
function record(id: string, operationType: Exclude<LedgerEntryInput['operationType'], 'manual_adjustment'>, amountMinor: number, iso: string): LedgerRecord {
  const effectiveAt = ts(iso);
  return { operationId: id, entry: createLedgerEntry({ schemaVersion: 1, operationType, currency: 'EUR', amountMinor,
    periodId: periodIdFor(effectiveAt), effectiveAt, recordedAt: calculatedAt, sourceType: 'fixture', sourceId: id,
    idempotencyKey: id, allocation: 'common_fund', createdBy: 'test-server',
    ...(operationType.startsWith('project_') ? { projectId: 'project-1', awardId: 'award-1' }
      : { paymentId: 'payment-1', ...(operationType === 'membership_payment' ? { uid: 'member-1' } : {}) }) }) };
}

it.each([
  ['2026-01', '2025-12-31T23:00:00Z', '2026-01-31T23:00:00Z'],
  ['2026-03', '2026-02-28T23:00:00Z', '2026-03-31T22:00:00Z'],
  ['2026-10', '2026-09-30T22:00:00Z', '2026-10-31T23:00:00Z'],
  ['2026-12', '2026-11-30T23:00:00Z', '2026-12-31T23:00:00Z'],
  ['2028-02', '2028-01-31T23:00:00Z', '2028-02-29T23:00:00Z'],
])('uses the Paris civil month for %s including DST, year change and leap year', (id, start, end) => {
  expect(fundPeriodBounds(id)).toEqual({ startsAt: ts(start), endsAt: ts(end) });
});

it('assigns timestamps at midnight Paris to the right month, with nanosecond precision', () => {
  const boundary = ts('2026-09-30T22:00:00Z');
  expect(periodIdFor(boundary)).toBe('2026-10');
  expect(periodIdFor({ seconds: boundary.seconds - 1, nanoseconds: 999999999 })).toBe('2026-09');
});

it('reconstructs opening balances, monthly categories, closing balances and a later-month reversal', () => {
  const income = record('september-income', 'extra_support', 500, '2026-09-15T10:00:00Z');
  const entries = [income,
    record('september-commitment', 'project_commitment', 300, '2026-09-16T10:00:00Z'),
    record('membership', 'membership_payment', 100, '2026-09-30T22:00:00Z'),
    record('support', 'extra_support', 500, '2026-10-05T10:00:00Z'),
    record('fee', 'payment_fee', 25, '2026-10-05T10:00:00Z'),
    record('commitment', 'project_commitment', 100, '2026-10-06T10:00:00Z'),
    record('release', 'project_commitment_release', 50, '2026-10-07T10:00:00Z'),
    record('payout', 'project_payout', 200, '2026-10-08T10:00:00Z'),
    record('refund', 'refund', 75, '2026-10-09T10:00:00Z'),
    record('november', 'extra_support', 1000, '2026-10-31T23:00:00Z')];
  const october = projectFundPeriod(entries, '2026-10', calculatedAt);
  expect(october).toMatchObject({ openingCashMinor: 500, openingCommitmentMinor: 300,
    membershipIncomeMinor: 100, supportIncomeMinor: 500, feesMinor: 25, refundsMinor: 75,
    newCommitmentsMinor: 100, releasedCommitmentsMinor: 50, payoutsMinor: 200,
    cashAdjustmentsMinor: 0, commitmentAdjustmentsMinor: 0,
    closingCashMinor: 800, closingCommitmentMinor: 150, availableMinor: 650 });
  expect(projectFundPeriod([...entries].reverse(), '2026-10', calculatedAt)).toEqual(october);
  const reversal = createReversal(income, { periodId: '2026-10', effectiveAt: ts('2026-10-10T10:00:00Z'), recordedAt: calculatedAt,
    sourceType: 'correction', sourceId: 'correction', idempotencyKey: 'correction', createdBy: 'test-server', reason: 'Correction with evidence' });
  const corrected = [...entries, { operationId: 'correction', entry: reversal }];
  expect(projectFundPeriod(corrected, '2026-10', calculatedAt)).toMatchObject({ openingCashMinor: 500, cashAdjustmentsMinor: -500,
    closingCashMinor: 300, closingCommitmentMinor: 150, availableMinor: 150 });
  expect(projectFundPeriod(corrected, '2026-09', calculatedAt)).toEqual(projectFundPeriod(entries, '2026-09', calculatedAt));
  expect(projectFundPeriod(corrected, '2026-11', calculatedAt)).toMatchObject({ openingCashMinor: 300, openingCommitmentMinor: 150,
    supportIncomeMinor: 1000, closingCashMinor: 1300, availableMinor: 1150 });
});

it('does not count an entry at the exclusive end, but counts the previous nanosecond', () => {
  const entry = record('last', 'extra_support', 1, '2026-10-31T22:59:59Z');
  entry.entry.effectiveAt = { ...entry.entry.effectiveAt, nanoseconds: 999999999 };
  expect(projectFundPeriod([entry], '2026-10', calculatedAt).supportIncomeMinor).toBe(1);
  expect(projectFundPeriod([record('next', 'extra_support', 1, '2026-10-31T23:00:00Z')], '2026-10', calculatedAt).supportIncomeMinor).toBe(0);
});

it('shows payout reversal adjustments in both cash and commitment reconciliation', () => {
  const payout = record('payout', 'project_payout', 300, '2026-10-05T10:00:00Z');
  const reversal = createReversal(payout, { periodId: '2026-10', effectiveAt: ts('2026-10-06T10:00:00Z'), recordedAt: calculatedAt,
    sourceType: 'correction', sourceId: 'reversal', idempotencyKey: 'reversal', createdBy: 'test-server', reason: 'Payout not executed' });
  const period = projectFundPeriod([
    record('income', 'extra_support', 500, '2026-10-01T10:00:00Z'),
    record('commitment', 'project_commitment', 300, '2026-10-02T10:00:00Z'), payout,
    { operationId: 'reversal', entry: reversal },
  ], '2026-10', calculatedAt);
  expect(period).toMatchObject({ payoutsMinor: 300, cashAdjustmentsMinor: 300, commitmentAdjustmentsMinor: 300,
    closingCashMinor: 500, closingCommitmentMinor: 300, availableMinor: 200 });
});

it('rejects invalid period IDs and projections with inconsistent totals', () => {
  for (const value of ['2026-00', '2026-13', '26-10', '2026-1', '0000-01']) expect(() => fundPeriodBounds(value)).toThrow();
  const period = projectFundPeriod([], '2026-10', calculatedAt);
  expect(period).toMatchObject({ openingCashMinor: 0, closingCashMinor: 0, availableMinor: 0 });
  expect(fundPeriodSchema.safeParse({ ...period, availableMinor: 1 }).success).toBe(false);
  expect(fundPeriodSchema.safeParse({ ...period, supportIncomeMinor: 100 }).success).toBe(false);
  expect(fundPeriodSchema.safeParse({ ...period, timezone: 'UTC' }).success).toBe(false);
  expect(fundPeriodSchema.safeParse({ ...period, startsAt: ts('2026-10-02T00:00:00Z') }).success).toBe(false);
  expect(fundPeriodSchema.safeParse({ ...period, periodId: '2026-11' }).success).toBe(false);
});
