import 'server-only';
import { z } from 'zod';
import { documentIdSchema, signedMinorSchema, timestampSchema } from '../../finance/values';

export const stateSchema = z.object({
  schemaVersion: z.literal(1), currency: z.literal('EUR'), cashMinor: signedMinorSchema,
  commitmentMinor: signedMinorSchema, availableMinor: signedMinorSchema,
  updatedAt: timestampSchema, lastOperationId: documentIdSchema,
}).strict().refine(s => BigInt(s.availableMinor) === BigInt(s.cashMinor) - BigInt(s.commitmentMinor));
