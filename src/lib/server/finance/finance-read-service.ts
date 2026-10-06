import 'server-only';
import type { Firestore } from 'firebase-admin/firestore';
import { calculateFundBalances, validateLedger } from '../../finance/ledger';
import { compareTimestamps, safeMinor } from '../../finance/values';
import { publicFinanceSchema, type PublicFinance } from '../../finance/public';
import { decodeTimestamps } from './firestore-values';
import { stateSchema } from './state';
import { ledgerEntrySchema } from '../../finance/ledger';

/** A consistent read-only snapshot; private document fields never cross this boundary. */
export async function readPublicFinance(db: Firestore): Promise<PublicFinance> {
  try {
    return await db.runTransaction(async tx => {
      const [state, ledger, periods] = await Promise.all([
        tx.get(db.doc('financeState/current')),
        tx.get(db.collection('financialLedger')),
        tx.get(db.collection('fundPeriods').limit(1)),
      ]);
      if (!state.exists) {
        if (!ledger.empty || !periods.empty) return { status: 'unavailable' } as const;
        return { status: 'empty', currency: 'EUR', cashMinor: 0, commitmentMinor: 0,
          availableMinor: 0, totalPaidToProjectsMinor: 0, entries: [] } as const;
      }
      const current = stateSchema.parse(decodeTimestamps(state.data()!, ['updatedAt']));
      const records = validateLedger(ledger.docs.map(doc => ({ operationId: doc.id,
        entry: ledgerEntrySchema.parse(decodeTimestamps(doc.data(), ['effectiveAt', 'recordedAt'])) })));
      const calculated = calculateFundBalances(records);
      if (ledger.empty || periods.empty || !records.some(record => record.operationId === current.lastOperationId)
        || calculated.cashMinor !== current.cashMinor
        || calculated.commitmentMinor !== current.commitmentMinor
        || calculated.availableMinor !== current.availableMinor) return { status: 'unavailable' } as const;
      const byId = new Map(records.map(record => [record.operationId, record.entry]));
      let paid = BigInt(0);
      for (const { entry } of records) {
        if (entry.operationType === 'project_payout') paid += BigInt(entry.amountMinor);
        if (entry.operationType === 'manual_adjustment' && entry.reversalOf
          && byId.get(entry.reversalOf)?.operationType === 'project_payout') paid -= BigInt(entry.amountMinor);
      }
      // No IDs, private references, authors or provider data in the public projection.
      const entries = records.sort((a, b) => compareTimestamps(b.entry.effectiveAt, a.entry.effectiveAt)
        || a.operationId.localeCompare(b.operationId)).map(({ entry }) => {
        const category = entry.operationType === 'manual_adjustment' && entry.reversalOf ? 'reversal' : entry.operationType;
        const negative = ['payment_fee', 'refund', 'project_payout', 'project_commitment_release'].includes(entry.operationType)
          || (entry.operationType === 'manual_adjustment' && entry.adjustmentDirection === 'decrease');
        const date = new Date(entry.effectiveAt.seconds * 1000).toISOString()
          .replace(/\.\d{3}Z$/, `.${String(entry.effectiveAt.nanoseconds).padStart(9, '0')}Z`);
        return { date, category, publicLabel: entry.publicLabel ?? null,
          amountMinor: negative ? -entry.amountMinor : entry.amountMinor };
      });
      return publicFinanceSchema.parse({ status: 'active', currency: current.currency,
        cashMinor: current.cashMinor, commitmentMinor: current.commitmentMinor, availableMinor: current.availableMinor,
        totalPaidToProjectsMinor: safeMinor(paid), entries });
    }, { readOnly: true });
  } catch {
    // Contract failures and infrastructure errors have the same controlled public response.
    return { status: 'unavailable' };
  }
}
