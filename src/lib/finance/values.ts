import { z } from 'zod';

/** Value contract shared by client/Admin Firestore Timestamps; no SDK or network dependency. */
export interface TimestampValue {
  readonly seconds: number;
  readonly nanoseconds: number;
}

export const timestampSchema = z.custom<TimestampValue>((value: unknown) => {
  if (typeof value !== 'object' || value === null || !('seconds' in value) || !('nanoseconds' in value)) return false;
  return typeof value.seconds === 'number' && Number.isSafeInteger(value.seconds)
    && value.seconds >= -62135596800 && value.seconds <= 253402300799
    && typeof value.nanoseconds === 'number' && Number.isInteger(value.nanoseconds)
    && value.nanoseconds >= 0 && value.nanoseconds < 1_000_000_000;
}, 'Expected a UTC Timestamp (seconds and nanoseconds)');

export const nonNegativeMinorSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const positiveMinorSchema = nonNegativeMinorSchema.positive();
export const signedMinorSchema = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
export const nonEmptyStringSchema = z.string().trim().min(1);
export const documentIdSchema = nonEmptyStringSchema.refine(v => !v.includes('/') && v !== '.' && v !== '..', 'Invalid document ID');
export const periodIdSchema = z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');
export const FUND_TIMEZONE = 'Europe/Paris' as const;

export function compareTimestamps(a: TimestampValue, b: TimestampValue): number {
  return a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;
}

export function timestampFromMillis(value: number): TimestampValue {
  if (!Number.isSafeInteger(value)) throw new Error('Invalid timestamp milliseconds');
  const seconds = Math.floor(value / 1000);
  return timestampSchema.parse({ seconds, nanoseconds: (value - seconds * 1000) * 1_000_000 });
}

const parisFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: FUND_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function parisParts(value: TimestampValue): Record<string, number> {
  const timestamp = timestampSchema.parse(value);
  const parts = parisFormatter.formatToParts(new Date(timestamp.seconds * 1000));
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}

export function periodIdFor(value: TimestampValue): string {
  const parts = parisParts(value);
  return periodIdSchema.parse(`${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}`);
}

/** Accumulate as bigint first: exact results, independent of input order. */
export function safeMinor(value: bigint): number {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Monetary total exceeds safe integer range');
  }
  return Number(value);
}
