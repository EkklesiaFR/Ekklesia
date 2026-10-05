import { z } from 'zod';
import type { FundBalances } from './types';
import {
  compareTimestamps, documentIdSchema, nonEmptyStringSchema, periodIdFor, periodIdSchema,
  positiveMinorSchema, safeMinor, signedMinorSchema, timestampSchema,
} from './values';

const normalOperationSchema = z.enum([
  'membership_payment', 'extra_support', 'payment_fee', 'refund',
  'project_commitment', 'project_commitment_release', 'project_payout',
]);
export type LedgerOperationType = z.infer<typeof normalOperationSchema> | 'manual_adjustment';

const common = {
  schemaVersion: z.literal(1),
  currency: z.literal('EUR'),
  amountMinor: positiveMinorSchema,
  periodId: periodIdSchema,
  effectiveAt: timestampSchema,
  recordedAt: timestampSchema,
  sourceType: nonEmptyStringSchema,
  sourceId: nonEmptyStringSchema,
  idempotencyKey: nonEmptyStringSchema,
  uid: documentIdSchema.optional(),
  paymentId: documentIdSchema.optional(),
  projectId: documentIdSchema.optional(),
  awardId: documentIdSchema.optional(),
  allocation: z.literal('common_fund'),
  publicLabel: nonEmptyStringSchema.optional(),
  createdBy: nonEmptyStringSchema,
};
const normalInputSchema = z.object({ ...common, operationType: normalOperationSchema }).strict();
const adjustmentInputSchema = z.object({
  ...common,
  operationType: z.literal('manual_adjustment'),
  reason: nonEmptyStringSchema,
  adjustmentTarget: z.enum(['cash', 'commitment', 'cash_and_commitment']),
  adjustmentDirection: z.enum(['increase', 'decrease']),
  reversalOf: documentIdSchema.optional(),
}).strict();
const inputSchema = z.discriminatedUnion('operationType', [normalInputSchema, adjustmentInputSchema]);
export type LedgerEntryInput = z.infer<typeof inputSchema>;

function deltas(input: LedgerEntryInput) {
  const amount = input.amountMinor;
  switch (input.operationType) {
    case 'membership_payment':
    case 'extra_support': return { cashDeltaMinor: amount, commitmentDeltaMinor: 0 };
    case 'payment_fee':
    case 'refund': return { cashDeltaMinor: -amount, commitmentDeltaMinor: 0 };
    case 'project_commitment': return { cashDeltaMinor: 0, commitmentDeltaMinor: amount };
    case 'project_commitment_release': return { cashDeltaMinor: 0, commitmentDeltaMinor: -amount };
    case 'project_payout': return { cashDeltaMinor: -amount, commitmentDeltaMinor: -amount };
    case 'manual_adjustment': {
      const signed = input.adjustmentDirection === 'increase' ? amount : -amount;
      return {
        cashDeltaMinor: input.adjustmentTarget === 'commitment' ? 0 : signed,
        commitmentDeltaMinor: input.adjustmentTarget === 'cash' ? 0 : signed,
      };
    }
  }
}

const deltaFields = { cashDeltaMinor: signedMinorSchema, commitmentDeltaMinor: signedMinorSchema };
export const ledgerEntrySchema = z.discriminatedUnion('operationType', [
  normalInputSchema.extend(deltaFields).strict(),
  adjustmentInputSchema.extend(deltaFields).strict(),
]).superRefine((entry, ctx) => {
  const expected = deltas(entry);
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (entry.cashDeltaMinor !== expected.cashDeltaMinor || entry.commitmentDeltaMinor !== expected.commitmentDeltaMinor) {
    issue('Deltas must match the operation type');
  }
  if (entry.operationType === 'membership_payment' && entry.amountMinor !== 100) issue('Monthly membership is exactly 100 cents');
  if (entry.periodId !== periodIdFor(entry.effectiveAt)) issue('periodId must match effectiveAt in Europe/Paris');
});
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
/** Document ID is supplied separately, never persisted as a competing ledger field. */
export type LedgerRecord = { operationId: string; entry: LedgerEntry };

/** Pure construction only; this is not authorization or persistence. Supplied deltas are rejected. */
export function createLedgerEntry(input: LedgerEntryInput): LedgerEntry {
  const valid = inputSchema.parse(input);
  return ledgerEntrySchema.parse({ ...valid, ...deltas(valid) });
}

const reversalMetadataSchema = z.object({
  periodId: common.periodId, effectiveAt: common.effectiveAt, recordedAt: common.recordedAt,
  sourceType: common.sourceType, sourceId: common.sourceId, idempotencyKey: common.idempotencyKey,
  createdBy: common.createdBy, reason: nonEmptyStringSchema,
}).strict();
export type ReversalMetadata = z.infer<typeof reversalMetadataSchema>;

/** A reversal is a new, motivated adjustment, exactly opposite to the original. */
export function createReversal(original: LedgerRecord, metadata: ReversalMetadata): LedgerEntry {
  const operationId = documentIdSchema.parse(original.operationId);
  const entry = ledgerEntrySchema.parse(original.entry);
  metadata = reversalMetadataSchema.parse(metadata);
  if (entry.operationType === 'manual_adjustment' && entry.reversalOf) throw new Error('Reversing a reversal is not supported in v1');
  if (compareTimestamps(metadata.effectiveAt, entry.effectiveAt) < 0) throw new Error('Reversal precedes its original');
  return createLedgerEntry({
    schemaVersion: 1, currency: 'EUR', allocation: 'common_fund', operationType: 'manual_adjustment',
    amountMinor: entry.amountMinor,
    ...metadata,
    ...(entry.uid ? { uid: entry.uid } : {}),
    ...(entry.paymentId ? { paymentId: entry.paymentId } : {}),
    ...(entry.projectId ? { projectId: entry.projectId } : {}),
    ...(entry.awardId ? { awardId: entry.awardId } : {}),
    reversalOf: operationId,
    adjustmentTarget: entry.cashDeltaMinor === 0 ? 'commitment' : entry.commitmentDeltaMinor === 0 ? 'cash' : 'cash_and_commitment',
    adjustmentDirection: (entry.cashDeltaMinor || entry.commitmentDeltaMinor) > 0 ? 'decrease' : 'increase',
  });
}

/** Requires the complete history: missing references or duplicate facts fail explicitly. */
export function validateLedger(records: readonly LedgerRecord[]): LedgerRecord[] {
  const entries = records.map(record => ({ operationId: documentIdSchema.parse(record.operationId), entry: ledgerEntrySchema.parse(record.entry) }));
  const byId = new Map<string, LedgerEntry>();
  const keys = new Set<string>();
  for (const { operationId, entry } of entries) {
    if (byId.has(operationId) || keys.has(entry.idempotencyKey)) throw new Error('Duplicate ledger operation or idempotency key');
    byId.set(operationId, entry);
    keys.add(entry.idempotencyKey);
  }
  const reversed = new Set<string>();
  for (const { operationId, entry } of entries) {
    if (entry.operationType !== 'manual_adjustment' || !entry.reversalOf) continue;
    const original = byId.get(entry.reversalOf);
    if (!original || operationId === entry.reversalOf) throw new Error('Missing or self-referencing reversal original');
    if (reversed.has(entry.reversalOf)) throw new Error('Original has already been reversed');
    // Corrections to corrections require a new explicit adjustment, not reversal chains/cycles.
    if (original.operationType === 'manual_adjustment' && original.reversalOf) throw new Error('Reversing a reversal is not supported in v1');
    if (entry.amountMinor !== original.amountMinor || entry.cashDeltaMinor !== -original.cashDeltaMinor
      || entry.commitmentDeltaMinor !== -original.commitmentDeltaMinor) throw new Error('Reversal must exactly negate its original');
    if (compareTimestamps(entry.effectiveAt, original.effectiveAt) < 0) throw new Error('Reversal precedes its original');
    for (const field of ['uid', 'paymentId', 'projectId', 'awardId'] as const) {
      if (entry[field] !== original[field]) throw new Error('Reversal references differ from its original');
    }
    reversed.add(entry.reversalOf);
  }
  return entries;
}

export function calculateFundBalances(records: readonly LedgerRecord[]): FundBalances {
  const entries = validateLedger(records);
  let cash = BigInt(0);
  let commitment = BigInt(0);
  for (const { entry } of entries) {
    cash += BigInt(entry.cashDeltaMinor);
    commitment += BigInt(entry.commitmentDeltaMinor);
  }
  return { cashMinor: safeMinor(cash), commitmentMinor: safeMinor(commitment), availableMinor: safeMinor(cash - commitment) };
}
