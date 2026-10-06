import { z } from 'zod';
import { nonNegativeMinorSchema, signedMinorSchema } from './values';

export const publicCategories = {
  membership_payment: 'Cotisation', extra_support: 'Soutien supplémentaire',
  payment_fee: 'Frais de paiement', refund: 'Remboursement',
  project_commitment: 'Engagement projet', project_commitment_release: 'Libération d’engagement',
  project_payout: 'Versement projet', manual_adjustment: 'Correction', reversal: 'Annulation',
} as const;

export const publicFinanceSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('unavailable') }).strict(),
  z.object({
    status: z.enum(['empty', 'active']), currency: z.literal('EUR'),
    cashMinor: signedMinorSchema, commitmentMinor: signedMinorSchema, availableMinor: signedMinorSchema,
    totalPaidToProjectsMinor: nonNegativeMinorSchema,
    entries: z.array(z.object({
      date: z.string().datetime({ precision: 9 }),
      category: z.enum(Object.keys(publicCategories) as [keyof typeof publicCategories, ...(keyof typeof publicCategories)[]]),
      publicLabel: z.string().nullable(), amountMinor: signedMinorSchema,
    }).strict()),
  }).strict(),
]);
export type PublicFinance = z.infer<typeof publicFinanceSchema>;

export function formatEuro(amountMinor: number): string {
  const minor = BigInt(amountMinor);
  const absolute = minor < BigInt(0) ? -minor : minor;
  const parts = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
    .formatToParts(absolute / BigInt(100));
  const formatted = parts.map(part => part.type === 'fraction'
    ? String(absolute % BigInt(100)).padStart(2, '0') : part.value).join('');
  return minor < BigInt(0) ? `-${formatted}` : formatted;
}
