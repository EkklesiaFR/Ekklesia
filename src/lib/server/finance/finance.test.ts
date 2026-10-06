import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { createLedgerEntry } from '../../finance/ledger';
import { projectFundPeriod } from '../../finance/periods';
import { decodeTimestamps, encodeTimestamps, fromAdminTimestamp, toAdminTimestamp } from './firestore-values';
import { operationIdFor, operationKeyId, requestHash } from './idempotency';
import { applyPeriodEntry, emptyPeriod } from './projections';

describe('server timestamp adapter', () => {
  it.each([
    { seconds: 0, nanoseconds: 1 }, { seconds: -1, nanoseconds: 999999999 },
    { seconds: -62135596800, nanoseconds: 0 }, { seconds: 253402300799, nanoseconds: 999999999 },
  ])('round-trips nanoseconds without milliseconds conversion: %j', value => {
    const timestamp = toAdminTimestamp(value);
    expect(timestamp).toBeInstanceOf(Timestamp);
    expect(fromAdminTimestamp(timestamp)).toEqual(value);
  });
  it('rejects persisted plain maps and invalid timestamp values', () => {
    expect(() => fromAdminTimestamp({ seconds: 0, nanoseconds: 0 })).toThrow();
    expect(() => toAdminTimestamp({ seconds: 0, nanoseconds: 1e9 })).toThrow();
  });
  it('retains precision lost by native Firestore storage using a validated remainder', () => {
    const value = { effectiveAt: { seconds: 123, nanoseconds: 123456789 }, uid: undefined };
    const encoded = encodeTimestamps(value, ['effectiveAt']);
    expect('uid' in encoded).toBe(false);
    expect(encoded.effectiveAt).toBeInstanceOf(Timestamp);
    expect(decodeTimestamps(encoded, ['effectiveAt'])).toEqual(value);
    for (const timestampRemainders of [{ effectiveAt: 1000 }, { effectiveAt: -1 }, { unknown: 789 }]) {
      expect(() => decodeTimestamps({ ...encoded, timestampRemainders }, ['effectiveAt'])).toThrow();
    }
  });
});

describe('deterministic command identity', () => {
  it('hashes arbitrary keys safely without replacing characters or truncating them', () => {
    const keys = ['payment/a:b', 'payment_a:b', 'payment/a_b', 'é/clé', 'e/clé', 'x'.repeat(2000)];
    expect(new Set(keys.map(operationIdFor)).size).toBe(keys.length);
    for (const key of keys) {
      expect(operationKeyId(key)).toMatch(/^[a-f0-9]{64}$/);
      expect(operationIdFor(key)).toBe(operationIdFor(key));
      expect(operationIdFor(key)).not.toContain('/');
    }
  });
  it('canonicalizes key order but distinguishes economic changes and nanoseconds', () => {
    expect(requestHash({ amount: 100, at: { seconds: 1, nanoseconds: 2 } }))
      .toBe(requestHash({ at: { nanoseconds: 2, seconds: 1 }, amount: 100 }));
    expect(requestHash({ amount: 100 })).not.toBe(requestHash({ amount: 101 }));
    expect(requestHash({ at: { seconds: 1, nanoseconds: 2 } }))
      .not.toBe(requestHash({ at: { seconds: 1, nanoseconds: 3 } }));
  });
});

it('incremental categories and late propagation match full ledger reconstruction', () => {
  const now = { seconds: Date.parse('2026-11-05T10:00:00Z') / 1000, nanoseconds: 0 };
  const specs = [
    ['extra_support', 1000, '2026-09'], ['project_commitment', 500, '2026-10'],
    ['project_payout', 200, '2026-10'], ['project_commitment_release', 100, '2026-11'],
    ['membership_payment', 100, '2026-09'], ['payment_fee', 10, '2026-09'], ['refund', 20, '2026-10'],
  ] as const;
  const periods = new Map(['2026-09', '2026-10', '2026-11'].map(id => [id, emptyPeriod(id, undefined, now)]));
  const records = specs.map(([operationType, amountMinor, periodId], i) => ({ operationId: `op-${i}`,
    entry: createLedgerEntry({ schemaVersion: 1, currency: 'EUR', allocation: 'common_fund',
      operationType, amountMinor, periodId, effectiveAt: { seconds: Date.parse(`${periodId}-05T10:00:00Z`) / 1000, nanoseconds: 123 },
      recordedAt: now, uid: 'member', paymentId: 'payment', projectId: 'project', awardId: 'award',
      sourceType: 'unit', sourceId: `${i}`, idempotencyKey: `${i}`, createdBy: 'system:unit' }) }));
  for (const { entry } of records) for (const [id, period] of periods) {
    if (id >= entry.periodId) periods.set(id, applyPeriodEntry(period, entry, now));
  }
  for (const [id, period] of periods) expect(period).toEqual(projectFundPeriod(records, id, now));
});
