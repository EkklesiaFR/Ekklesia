import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import { timestampSchema, type TimestampValue } from '../../finance/values';

export function toAdminTimestamp(value: TimestampValue): Timestamp {
  const valid = timestampSchema.parse(value);
  return new Timestamp(valid.seconds, valid.nanoseconds);
}

export function fromAdminTimestamp(value: unknown): TimestampValue {
  if (!(value instanceof Timestamp)) throw new Error('Expected an Admin Firestore Timestamp');
  return timestampSchema.parse({ seconds: value.seconds, nanoseconds: value.nanoseconds });
}

/** Explicit field lists prevent treating arbitrary business maps as timestamps. */
export function encodeTimestamps<T extends object>(value: T, fields: readonly (keyof T)[]) {
  // Optional contract fields may be explicitly undefined; Firestore requires absence.
  const encoded = Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;
  const remainders: Record<string, number> = {};
  for (const field of fields) {
    if (value[field] !== undefined) {
      const timestamp = toAdminTimestamp(value[field] as TimestampValue);
      const remainder = timestamp.nanoseconds % 1000;
      // Firestore storage truncates to microseconds. Retain sub-microsecond precision
      // separately while every actual date field remains a native Timestamp.
      if (remainder) remainders[String(field)] = remainder;
      Object.assign(encoded, { [field]: new Timestamp(timestamp.seconds, timestamp.nanoseconds - remainder) });
    }
  }
  if (Object.keys(remainders).length) Object.assign(encoded, { timestampRemainders: remainders });
  return encoded;
}

export function decodeTimestamps(value: Record<string, unknown>, fields: readonly string[]) {
  const decoded = { ...value };
  const remainders = value.timestampRemainders;
  if (remainders !== undefined) {
    if (!remainders || typeof remainders !== 'object' || Array.isArray(remainders)) throw new Error('Invalid timestamp remainders');
    for (const [field, remainder] of Object.entries(remainders)) {
      if (!fields.includes(field) || value[field] === undefined || !Number.isInteger(remainder)
        || typeof remainder !== 'number' || remainder <= 0 || remainder >= 1000) throw new Error('Invalid timestamp remainder');
    }
  }
  for (const field of fields) {
    if (value[field] !== undefined) {
      const timestamp = fromAdminTimestamp(value[field]);
      const remainder = (remainders as Record<string, number> | undefined)?.[field] ?? 0;
      if (remainder && timestamp.nanoseconds % 1000 !== 0) throw new Error('Timestamp remainder requires microsecond-aligned storage');
      decoded[field] = timestampSchema.parse({ seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds + remainder });
    }
  }
  delete decoded.timestampRemainders;
  return decoded;
}
