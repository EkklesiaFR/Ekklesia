import { z } from 'zod';
import { compareTimestamps, documentIdSchema, nonEmptyStringSchema, timestampSchema } from '../finance/values';

export const membershipStatusSchema = z.enum(['pending_payment', 'active', 'past_due', 'expired']);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const membershipSchema = z.object({
  schemaVersion: z.literal(1),
  uid: documentIdSchema,
  status: membershipStatusSchema,
  planVersion: z.literal('monthly-1-eur-v1'),
  currency: z.literal('EUR'),
  requiredAmountMinor: z.literal(100),
  interval: z.literal('month'),
  currentPeriodStart: timestampSchema.optional(),
  currentPeriodEnd: timestampSchema.optional(),
  paidThrough: timestampSchema.optional(),
  cancelAtPeriodEnd: z.boolean(),
  provider: nonEmptyStringSchema.optional(),
  externalCustomerId: nonEmptyStringSchema.optional(),
  externalSubscriptionId: nonEmptyStringSchema.optional(),
  lastConfirmedPaymentId: documentIdSchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict().superRefine((value, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (compareTimestamps(value.updatedAt, value.createdAt) < 0) issue('updatedAt precedes createdAt');
  if (!!value.currentPeriodStart !== !!value.currentPeriodEnd) issue('Membership period requires both boundaries');
  if (value.currentPeriodStart && value.currentPeriodEnd && compareTimestamps(value.currentPeriodStart, value.currentPeriodEnd) >= 0) {
    issue('Membership period must have a positive duration');
  }
  if (value.status === 'active' && (!value.currentPeriodStart || !value.currentPeriodEnd || !value.paidThrough)) {
    issue('Active membership requires an acquired period');
  }
  if (value.paidThrough && value.currentPeriodEnd && compareTimestamps(value.paidThrough, value.currentPeriodEnd) < 0 && value.status === 'active') {
    issue('Active membership must cover the acquired period');
  }
  // Cancellation is a request, not the loss of an already paid period.
});
export type Membership = z.infer<typeof membershipSchema>;
