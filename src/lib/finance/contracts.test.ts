import { describe, expect, it } from 'vitest';
import { membershipSchema } from '../membership/types';
import { paymentEventSchema, paymentSchema } from './types';
import { timestampFromMillis, timestampSchema } from './values';

const start = timestampFromMillis(Date.parse('2026-10-05T10:00:00Z'));
const end = timestampFromMillis(Date.parse('2026-11-05T10:00:00Z'));
const membership = { schemaVersion: 1, uid: 'member', status: 'active', planVersion: 'monthly-1-eur-v1', currency: 'EUR',
  requiredAmountMinor: 100, interval: 'month', currentPeriodStart: start, currentPeriodEnd: end, paidThrough: end,
  cancelAtPeriodEnd: false, createdAt: start, updatedAt: start };
const payment = { schemaVersion: 1, uid: 'member', currency: 'EUR', grossAmountMinor: 600, membershipAmountMinor: 100,
  supportAmountMinor: 500, feeAmountMinor: 25, refundedAmountMinor: 0, status: 'confirmed',
  membershipPeriodStart: start, membershipPeriodEnd: end, createdAt: start, confirmedAt: start, updatedAt: start };

describe('independent membership contract', () => {
  it('keeps an acquired membership active when cancellation is requested', () => {
    expect(membershipSchema.parse({ ...membership, cancelAtPeriodEnd: true }).status).toBe('active');
  });
  it('permits a pending membership without inventing a paid period', () => {
    const { currentPeriodStart, currentPeriodEnd, paidThrough, ...pending } = membership;
    expect(membershipSchema.parse({ ...pending, status: 'pending_payment' }).paidThrough).toBeUndefined();
    expect(membershipSchema.safeParse(pending).success).toBe(false);
  });
  it.each([{ interval: 'year' }, { requiredAmountMinor: 1200 }, { requiredAmountMinor: 99 }, { currency: 'USD' },
    { role: 'admin' }, { status: 'blocked' }, { status: 'disabled' }, { status: 'revoked' }, { status: 'cancelled' },
    { paidThrough: start }, { currentPeriodEnd: start }])('rejects account semantics or invalid plan/period: %j', patch => {
    expect(membershipSchema.safeParse({ ...membership, ...patch }).success).toBe(false);
  });
});

describe('payments represent economic operations, not webhook envelopes', () => {
  it('splits membership and support before fees, and permits support-only payments', () => {
    expect(paymentSchema.parse(payment).grossAmountMinor).toBe(600);
    expect(paymentSchema.parse({ ...payment, membershipAmountMinor: 0, supportAmountMinor: 600 }).membershipAmountMinor).toBe(0);
    expect(paymentSchema.parse({ ...payment, grossAmountMinor: 100, supportAmountMinor: 0 }).supportAmountMinor).toBe(0);
  });
  it.each(['grossAmountMinor', 'membershipAmountMinor', 'supportAmountMinor', 'feeAmountMinor', 'refundedAmountMinor'] as const)
    ('refuses invalid numbers in %s', field => {
      for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        expect(paymentSchema.safeParse({ ...payment, [field]: value }).success).toBe(false);
      }
    });
  it('checks allocation equality, refund limits/status and acquired period', () => {
    for (const patch of [{ grossAmountMinor: 601 }, { membershipAmountMinor: 1200, grossAmountMinor: 1700 },
      { status: 'refunded', refundedAmountMinor: 601 }, { status: 'refunded', refundedAmountMinor: 100 },
      { status: 'partially_refunded', refundedAmountMinor: 0 }, { refundedAmountMinor: 50 },
      { confirmedAt: undefined }, { membershipPeriodStart: undefined, membershipPeriodEnd: undefined }]) {
      expect(paymentSchema.safeParse({ ...payment, ...patch }).success).toBe(false);
    }
    expect(paymentSchema.parse({ ...payment, status: 'partially_refunded', refundedAmountMinor: 50 }).status).toBe('partially_refunded');
    expect(paymentSchema.parse({ ...payment, status: 'refunded', refundedAmountMinor: 600 }).status).toBe('refunded');
  });
});

it('stores event metadata only: no raw payload or banking fields', () => {
  const event = { schemaVersion: 1, provider: 'future-provider', externalEventId: 'event-1', eventType: 'test', receivedAt: start, status: 'received' };
  expect(paymentEventSchema.parse(event).externalEventId).toBe('event-1');
  expect(paymentEventSchema.safeParse({ ...event, payload: { iban: 'sensitive' } }).success).toBe(false);
  expect(paymentEventSchema.safeParse({ ...event, bankAccount: 'sensitive' }).success).toBe(false);
});

it('validates UTC timestamps including nanoseconds, without accepting Date or ISO strings', () => {
  expect(timestampSchema.parse({ seconds: start.seconds, nanoseconds: 999999999 }).nanoseconds).toBe(999999999);
  for (const value of [new Date(), '2026-10-05', null, { seconds: 0, nanoseconds: 1e9 }, { seconds: 0.5, nanoseconds: 0 }, { seconds: Infinity, nanoseconds: 0 }]) {
    expect(timestampSchema.safeParse(value).success).toBe(false);
  }
});
