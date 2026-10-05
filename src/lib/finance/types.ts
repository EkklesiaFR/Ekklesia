import { z } from 'zod';
import {
  compareTimestamps, documentIdSchema, FUND_TIMEZONE, nonEmptyStringSchema,
  nonNegativeMinorSchema, parisParts, periodIdSchema, signedMinorSchema, timestampSchema,
} from './values';

export const paymentSchema = z.object({
  schemaVersion: z.literal(1),
  uid: documentIdSchema,
  currency: z.literal('EUR'),
  grossAmountMinor: nonNegativeMinorSchema,
  membershipAmountMinor: z.union([z.literal(0), z.literal(100)]),
  supportAmountMinor: nonNegativeMinorSchema,
  feeAmountMinor: nonNegativeMinorSchema,
  refundedAmountMinor: nonNegativeMinorSchema,
  status: z.enum(['pending', 'confirmed', 'failed', 'partially_refunded', 'refunded']),
  membershipPeriodStart: timestampSchema.optional(),
  membershipPeriodEnd: timestampSchema.optional(),
  provider: nonEmptyStringSchema.optional(),
  externalPaymentId: nonEmptyStringSchema.optional(),
  createdAt: timestampSchema,
  confirmedAt: timestampSchema.optional(),
  updatedAt: timestampSchema,
}).strict().superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if ([value.membershipAmountMinor, value.supportAmountMinor, value.grossAmountMinor].every(Number.isSafeInteger)
    && BigInt(value.membershipAmountMinor) + BigInt(value.supportAmountMinor) !== BigInt(value.grossAmountMinor)) {
    issue('Membership plus support must equal gross, before fees');
  }
  if (value.refundedAmountMinor > value.grossAmountMinor) issue('Refund exceeds gross');
  if (compareTimestamps(value.updatedAt, value.createdAt) < 0) issue('updatedAt precedes createdAt');
  if (!!value.membershipPeriodStart !== !!value.membershipPeriodEnd) issue('Payment period requires both boundaries');
  if (value.membershipPeriodStart && value.membershipPeriodEnd && compareTimestamps(value.membershipPeriodStart, value.membershipPeriodEnd) >= 0) {
    issue('Payment period must have a positive duration');
  }
  const settled = ['confirmed', 'partially_refunded', 'refunded'].includes(value.status);
  if (settled && !value.confirmedAt) issue('Settled payment requires confirmedAt');
  if (settled && value.membershipAmountMinor === 100 && !value.membershipPeriodStart) issue('Settled membership payment requires its period');
  if (value.confirmedAt && (compareTimestamps(value.confirmedAt, value.createdAt) < 0 || compareTimestamps(value.confirmedAt, value.updatedAt) > 0)) {
    issue('confirmedAt must be between createdAt and updatedAt');
  }
  if (value.status === 'partially_refunded') {
    if (value.refundedAmountMinor <= 0 || value.refundedAmountMinor >= value.grossAmountMinor) issue('Invalid partial refund');
  } else if (value.status === 'refunded') {
    if (value.refundedAmountMinor === 0 || value.refundedAmountMinor !== value.grossAmountMinor) issue('Invalid full refund');
  } else if (value.refundedAmountMinor !== 0) issue('Refund amount does not match payment status');
});
export type Payment = z.infer<typeof paymentSchema>;

export const paymentEventSchema = z.object({
  schemaVersion: z.literal(1),
  provider: nonEmptyStringSchema,
  externalEventId: nonEmptyStringSchema,
  externalObjectId: nonEmptyStringSchema.optional(),
  eventType: nonEmptyStringSchema,
  occurredAt: timestampSchema.optional(),
  receivedAt: timestampSchema,
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  status: z.enum(['received', 'processed', 'ignored', 'failed']),
  processedAt: timestampSchema.optional(),
  errorCode: nonEmptyStringSchema.optional(),
}).strict();
export type PaymentEvent = z.infer<typeof paymentEventSchema>;

export type FundBalances = {
  cashMinor: number;
  commitmentMinor: number;
  availableMinor: number;
};

export const fundPeriodSchema = z.object({
  schemaVersion: z.literal(1),
  periodId: periodIdSchema,
  timezone: z.literal(FUND_TIMEZONE),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  membershipIncomeMinor: nonNegativeMinorSchema,
  supportIncomeMinor: nonNegativeMinorSchema,
  feesMinor: nonNegativeMinorSchema,
  refundsMinor: nonNegativeMinorSchema,
  newCommitmentsMinor: nonNegativeMinorSchema,
  releasedCommitmentsMinor: nonNegativeMinorSchema,
  payoutsMinor: nonNegativeMinorSchema,
  // Signed corrections keep the monthly reconciliation explicit.
  cashAdjustmentsMinor: signedMinorSchema,
  commitmentAdjustmentsMinor: signedMinorSchema,
  openingCashMinor: signedMinorSchema,
  closingCashMinor: signedMinorSchema,
  openingCommitmentMinor: signedMinorSchema,
  closingCommitmentMinor: signedMinorSchema,
  availableMinor: signedMinorSchema,
  calculatedAt: timestampSchema,
}).strict().superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (compareTimestamps(value.startsAt, value.endsAt) >= 0) issue('Invalid period boundaries');
  const [year, month] = value.periodId.split('-').map(Number);
  const start = parisParts(value.startsAt), end = parisParts(value.endsAt);
  const isMidnight = (parts: Record<string, number>) => parts.day === 1 && parts.hour === 0 && parts.minute === 0 && parts.second === 0;
  if (!isMidnight(start) || !isMidnight(end) || value.startsAt.nanoseconds !== 0 || value.endsAt.nanoseconds !== 0
    || start.year !== year || start.month !== month
    || end.year !== (month === 12 ? year + 1 : year) || end.month !== (month === 12 ? 1 : month + 1)) {
    issue('Boundaries must match the Paris civil month');
  }
  const monetaryValues = Object.entries(value).filter(([key]) => key.endsWith('Minor')).map(([, amount]) => amount);
  if (!monetaryValues.every(amount => typeof amount === 'number' && Number.isSafeInteger(amount))) return;
  const closingCash = BigInt(value.openingCashMinor) + BigInt(value.membershipIncomeMinor) + BigInt(value.supportIncomeMinor)
    - BigInt(value.feesMinor) - BigInt(value.refundsMinor) - BigInt(value.payoutsMinor) + BigInt(value.cashAdjustmentsMinor);
  const closingCommitment = BigInt(value.openingCommitmentMinor) + BigInt(value.newCommitmentsMinor)
    - BigInt(value.releasedCommitmentsMinor) - BigInt(value.payoutsMinor) + BigInt(value.commitmentAdjustmentsMinor);
  if (closingCash !== BigInt(value.closingCashMinor) || closingCommitment !== BigInt(value.closingCommitmentMinor)
    || closingCash - closingCommitment !== BigInt(value.availableMinor)) issue('Period totals do not reconcile with ledger deltas');
});
export type FundPeriod = z.infer<typeof fundPeriodSchema>;
