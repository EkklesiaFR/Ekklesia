import { describe, expect, it } from 'vitest';
import { calculateFundBalances, createLedgerEntry, createReversal, ledgerEntrySchema, type LedgerEntryInput, type LedgerRecord } from './ledger';
import { timestampFromMillis } from './values';

const at = timestampFromMillis(Date.parse('2026-10-05T10:00:00Z'));
function input(operationType: Exclude<LedgerEntryInput['operationType'], 'manual_adjustment'>, amountMinor: number, key = operationType): LedgerEntryInput {
  return { schemaVersion: 1, operationType, currency: 'EUR', amountMinor, periodId: '2026-10',
    effectiveAt: at, recordedAt: at, sourceType: 'test', sourceId: key, idempotencyKey: key, allocation: 'common_fund', createdBy: 'test-server' };
}
function record(operationType: Exclude<LedgerEntryInput['operationType'], 'manual_adjustment'>, amountMinor: number): LedgerRecord {
  return { operationId: operationType, entry: createLedgerEntry(input(operationType, amountMinor)) };
}
const reversalMetadata = { periodId: '2026-10', effectiveAt: at, recordedAt: at, sourceType: 'correction', sourceId: 'correction-1',
  idempotencyKey: 'correction-1', createdBy: 'authorized-admin', reason: 'Duplicate external confirmation corrected' };

describe('cash and commitments reconstructed only from ledger records', () => {
  it('adds membership and support, subtracts fees, reserves funds and pays without double subtraction', () => {
    const entries = [record('membership_payment', 100)];
    expect(calculateFundBalances(entries)).toEqual({ cashMinor: 100, commitmentMinor: 0, availableMinor: 100 });
    entries.push(record('extra_support', 500));
    expect(calculateFundBalances(entries)).toEqual({ cashMinor: 600, commitmentMinor: 0, availableMinor: 600 });
    entries.push(record('payment_fee', 25));
    expect(calculateFundBalances(entries)).toEqual({ cashMinor: 575, commitmentMinor: 0, availableMinor: 575 });
    entries.push(record('project_commitment', 300));
    expect(calculateFundBalances(entries)).toEqual({ cashMinor: 575, commitmentMinor: 300, availableMinor: 275 });
    entries.push(record('project_payout', 300));
    expect(calculateFundBalances(entries)).toEqual({ cashMinor: 275, commitmentMinor: 0, availableMinor: 275 });
    expect(calculateFundBalances([...entries].reverse())).toEqual(calculateFundBalances(entries));
  });

  it('releases commitments and records refunds separately from project payouts', () => {
    const entries = [record('extra_support', 500), record('project_commitment', 300), record('project_commitment_release', 100)];
    expect(calculateFundBalances(entries)).toEqual({ cashMinor: 500, commitmentMinor: 200, availableMinor: 300 });
    entries.push(record('refund', 50));
    expect(calculateFundBalances(entries)).toEqual({ cashMinor: 450, commitmentMinor: 200, availableMinor: 250 });
  });

  it('keeps the available amount unchanged during a partial payout', () => {
    expect(calculateFundBalances([record('extra_support', 500), record('project_commitment', 300), record('project_payout', 100)]))
      .toEqual({ cashMinor: 400, commitmentMinor: 200, availableMinor: 200 });
  });

  it('returns zero for an empty history without initializing stored data, and exposes deficits without clamping', () => {
    expect(calculateFundBalances([])).toEqual({ cashMinor: 0, commitmentMinor: 0, availableMinor: 0 });
    expect(calculateFundBalances([record('refund', 100)])).toEqual({ cashMinor: -100, commitmentMinor: 0, availableMinor: -100 });
  });

  it.each(['membership_payment', 'extra_support', 'payment_fee', 'refund', 'project_commitment', 'project_commitment_release', 'project_payout'] as const)
    ('reverses %s exactly without mutating its original', type => {
      const original = record(type, 100);
      const before = JSON.stringify(original);
      const reversal = { operationId: 'reversal', entry: createReversal(original, reversalMetadata) };
      expect(calculateFundBalances([reversal, original])).toEqual({ cashMinor: 0, commitmentMinor: 0, availableMinor: 0 });
      expect(JSON.stringify(original)).toBe(before);
      expect(reversal.entry).toMatchObject({ operationType: 'manual_adjustment', reversalOf: original.operationId });
    });

  it('requires a reason and derives manual adjustment deltas from its target and direction', () => {
    const adjustment: LedgerEntryInput = { ...input('extra_support', 100), operationType: 'manual_adjustment',
      adjustmentTarget: 'cash', adjustmentDirection: 'decrease', reason: 'Documented correction' };
    expect(createLedgerEntry(adjustment)).toMatchObject({ cashDeltaMinor: -100, commitmentDeltaMinor: 0 });
    expect(() => createLedgerEntry({ ...adjustment, reason: ' ' })).toThrow();
  });

  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid amount %s', amount => {
    expect(() => createLedgerEntry(input('extra_support', amount))).toThrow();
  });

  it('rejects wrong membership amounts, currencies, allocations, periods and supplied or forged deltas', () => {
    expect(() => createLedgerEntry(input('membership_payment', 1200))).toThrow();
    const clientDeltas = { ...input('extra_support', 100), cashDeltaMinor: 100 };
    expect(() => createLedgerEntry(clientDeltas)).toThrow();
    const original = record('extra_support', 100);
    for (const patch of [{ currency: 'USD' }, { allocation: 'other' }, { periodId: '2026-09' }, { periodId: '2026-13' },
      { cashDeltaMinor: 999 }, { commitmentDeltaMinor: 100 }, { schemaVersion: 2 }, { operationType: 'unknown' }]) {
      expect(ledgerEntrySchema.safeParse({ ...original.entry, ...patch }).success).toBe(false);
    }
  });

  it('rejects duplicate IDs and economic idempotency keys rather than silently double-counting', () => {
    const original = record('extra_support', 100);
    expect(() => calculateFundBalances([original, original])).toThrow(/Duplicate/);
    expect(() => calculateFundBalances([original, { ...original, operationId: 'other' }])).toThrow(/Duplicate/);
  });

  it('rejects missing, duplicated, forged, backdated or chained reversals', () => {
    const original = record('project_payout', 100);
    const reversal = { operationId: 'reversal', entry: createReversal(original, reversalMetadata) };
    expect(() => calculateFundBalances([reversal])).toThrow(/Missing/);
    expect(() => calculateFundBalances([{ ...reversal, operationId: original.operationId }])).toThrow(/self-referencing/);
    expect(() => calculateFundBalances([original, { ...reversal, entry: { ...reversal.entry, uid: 'different-member' } }])).toThrow(/references differ/);
    const second = { operationId: 'second', entry: createReversal(original, { ...reversalMetadata, idempotencyKey: 'second' }) };
    expect(() => calculateFundBalances([original, reversal, second])).toThrow(/already/);
    expect(() => calculateFundBalances([original, { ...reversal, entry: { ...reversal.entry, amountMinor: 200, cashDeltaMinor: 200, commitmentDeltaMinor: 200 } }])).toThrow(/negate/);
    expect(() => createReversal(original, { ...reversalMetadata, effectiveAt: timestampFromMillis(Date.parse('2026-10-04T10:00:00Z')) })).toThrow(/precedes/);
    expect(() => createReversal(reversal, { ...reversalMetadata, idempotencyKey: 'chained' })).toThrow(/not supported/);
    const chained = { operationId: 'chained', entry: createReversal(original, { ...reversalMetadata, idempotencyKey: 'chained' }) };
    if (chained.entry.operationType === 'manual_adjustment') chained.entry.reversalOf = 'reversal';
    expect(() => calculateFundBalances([original, reversal, chained])).toThrow(/not supported/);
  });

  it('rejects overflow, but sums cancelling large amounts exactly regardless of order', () => {
    const max = record('extra_support', Number.MAX_SAFE_INTEGER);
    const fee = record('payment_fee', Number.MAX_SAFE_INTEGER);
    const small = record('membership_payment', 100);
    expect(() => calculateFundBalances([max, small])).toThrow(/safe integer/);
    expect(calculateFundBalances([max, small, fee])).toEqual({ cashMinor: 100, commitmentMinor: 0, availableMinor: 100 });
    expect(() => calculateFundBalances([max, record('project_commitment_release', 1)])).toThrow(/safe integer/);
  });
});
