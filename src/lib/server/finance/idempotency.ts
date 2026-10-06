import 'server-only';
import { createHash } from 'node:crypto';

export const operationKeyId = (key: string) => createHash('sha256').update(key, 'utf8').digest('hex');
export const operationIdFor = (key: string) => `finance_${operationKeyId(key)}`;

/** Sort object keys recursively; commands are validated before hashing. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, canonical(v)]));
  }
  return value;
}

export function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value)), 'utf8').digest('hex');
}
