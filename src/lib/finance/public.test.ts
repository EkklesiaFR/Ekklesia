import { describe, expect, it } from 'vitest';
import { formatEuro, publicFinanceSchema } from './public';

describe('public finance contract', () => {
  it('formats minor units as French euros', () => {
    expect(formatEuro(0).replace(/\s/g, ' ')).toBe('0,00 €');
    expect(formatEuro(123456).replace(/\s/g, ' ')).toBe('1 234,56 €');
    expect(formatEuro(-1).replace(/\s/g, ' ')).toBe('-0,01 €');
    expect(formatEuro(Number.MAX_SAFE_INTEGER).replace(/\s/g, ' ')).toBe('90 071 992 547 409,91 €');
  });
  it('keeps unavailable distinct from a zero balance', () => {
    expect(publicFinanceSchema.parse({ status: 'unavailable' })).toEqual({ status: 'unavailable' });
    expect(publicFinanceSchema.safeParse({ status: 'unavailable', cashMinor: 0 }).success).toBe(false);
  });
  it('rejects unexpected private fields at the public boundary', () => {
    const empty = { status: 'empty', currency: 'EUR', cashMinor: 0, commitmentMinor: 0,
      availableMinor: 0, totalPaidToProjectsMinor: 0, entries: [] };
    expect(publicFinanceSchema.safeParse(empty).success).toBe(true);
    expect(publicFinanceSchema.safeParse({ ...empty, uid: 'private' }).success).toBe(false);
    expect(publicFinanceSchema.safeParse({ ...empty, entries: [{ date: '2026-10-06T00:00:00.000000001Z',
      category: 'extra_support', publicLabel: null, amountMinor: 100, paymentId: 'private' }] }).success).toBe(false);
  });
});
