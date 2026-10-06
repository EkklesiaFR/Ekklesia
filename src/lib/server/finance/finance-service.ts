import 'server-only';
import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { createLedgerEntry, createReversal, ledgerEntrySchema, type LedgerEntry,
  type LedgerEntryInput, type LedgerRecord, type ReversalMetadata } from '../../finance/ledger';
import { fundPeriodBounds } from '../../finance/periods';
import { fundPeriodSchema, paymentSchema, type FundPeriod } from '../../finance/types';
import { compareTimestamps, documentIdSchema, nonEmptyStringSchema, safeMinor, timestampSchema,
} from '../../finance/values';
import { stateSchema } from './state';
import { FinanceError } from './errors';
import { decodeTimestamps, encodeTimestamps, fromAdminTimestamp, toAdminTimestamp } from './firestore-values';
import { operationIdFor, operationKeyId, requestHash } from './idempotency';
import { addMinor, applyPeriodEntry, emptyPeriod, periodTimestampFields } from './projections';

export { FinanceError } from './errors';
export type FinanceActor = { kind: 'system'; service: string } | { kind: 'admin'; uid: string };
type WithoutServerFields<T> = T extends unknown ? Omit<T, 'recordedAt' | 'createdBy' | 'reversalOf'> : never;
export type FinanceCommand = WithoutServerFields<LedgerEntryInput>
  | (Omit<ReversalMetadata, 'recordedAt' | 'createdBy'> & { operationType: 'reversal'; reversalOf: string });
export type FinanceResult = LedgerRecord & { replayed: boolean };

const actorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('system'), service: nonEmptyStringSchema }).strict(),
  z.object({ kind: z.literal('admin'), uid: documentIdSchema }).strict(),
]);
const keySchema = z.object({ schemaVersion: z.literal(1), idempotencyKey: nonEmptyStringSchema,
  requestHash: z.string().regex(/^[a-f0-9]{64}$/), operationId: documentIdSchema, createdAt: timestampSchema }).strict();
const ledgerTimestampFields = ['effectiveAt', 'recordedAt'] as const;
const systemTypes = new Set(['membership_payment', 'extra_support', 'payment_fee', 'refund']);

function readEntry(data: Record<string, unknown>): LedgerEntry {
  return ledgerEntrySchema.parse(decodeTimestamps(data, ledgerTimestampFields));
}
function normalizeEntry(entry: LedgerEntry): LedgerEntry {
  return { ...entry, effectiveAt: { seconds: entry.effectiveAt.seconds, nanoseconds: entry.effectiveAt.nanoseconds } };
}
function reconstruction<T>(read: () => T): T {
  try { return read(); } catch { throw new FinanceError('RECONSTRUCTION_REQUIRED'); }
}
function economicHash(entry: LedgerEntry) {
  const { recordedAt, ...economic } = entry;
  // TimestampValue is structural: SDK Timestamp getters and plain values must
  // describe the same command, regardless of the SDK's private instance fields.
  return requestHash({ ...economic, effectiveAt: {
    seconds: entry.effectiveAt.seconds, nanoseconds: entry.effectiveAt.nanoseconds,
  } });
}

/** All reads first, no database writes until write() is called inside the SAME transaction.
 * A batch supports Payment plus its membership/support/fee entries at Lot 2.
 * Call this helper once per transaction, with every financial command in order.
 * The supplied actor is a trusted server capability, never an HTTP/client assertion.
 */
export async function prepareFinanceOperations(
  tx: Transaction, db: Firestore, commands: readonly FinanceCommand[], actor: FinanceActor,
): Promise<{ results: FinanceResult[]; write: () => void }> {
  if (!commands.length || commands.length > 100) throw new FinanceError('INVALID_COMMAND');
  const parsedActor = actorSchema.safeParse(actor);
  if (!parsedActor.success) throw new FinanceError('UNAUTHORIZED');
  actor = parsedActor.data;
  const createdBy = actor.kind === 'system' ? `system:${actor.service}` : `admin:${actor.uid}`;
  const now = fromAdminTimestamp(Timestamp.now());
  const ledger = db.collection('financialLedger');
  const stateRef = db.doc('financeState/current');
  // This shared document serializes economic checks, including first initialization.
  const stateSnap = await tx.get(stateRef);
  if (actor.kind === 'admin') {
    const member = (await tx.get(db.doc(`members/${actor.uid}`))).data();
    if (member?.role !== 'admin' || member.status !== 'active') throw new FinanceError('UNAUTHORIZED');
  }

  const prepared: { entry: LedgerEntry; original?: LedgerRecord }[] = [];
  for (const command of commands) {
    if (!command || typeof command !== 'object' || 'createdBy' in command || 'recordedAt' in command
      || (command.operationType !== 'reversal' && 'reversalOf' in command)) throw new FinanceError('INVALID_COMMAND');
    if (systemTypes.has(command.operationType) !== (actor.kind === 'system')) throw new FinanceError('UNAUTHORIZED');
    try {
      if (command.operationType === 'reversal') {
        const { operationType, reversalOf, ...metadata } = command;
        const originalSnap = await tx.get(ledger.doc(documentIdSchema.parse(reversalOf)));
        if (!originalSnap.exists) throw new FinanceError('INVALID_REVERSAL');
        const original = { operationId: originalSnap.id, entry: readEntry(originalSnap.data()!) };
        prepared.push({ original, entry: normalizeEntry(createReversal(original, { ...metadata, recordedAt: now, createdBy })) });
      } else {
        prepared.push({ entry: normalizeEntry(createLedgerEntry({ ...command, recordedAt: now, createdBy })) });
      }
    } catch (error) {
      if (error instanceof FinanceError) throw error;
      throw new FinanceError('INVALID_COMMAND', error instanceof Error ? error.message : 'Invalid command');
    }
  }
  for (const { entry } of prepared) {
    if (compareTimestamps(entry.effectiveAt, now) > 0) {
      throw new FinanceError('INVALID_COMMAND', 'effectiveAt must not be later than the server time');
    }
  }
  if (new Set(prepared.map(p => p.entry.idempotencyKey)).size !== prepared.length) {
    throw new FinanceError('INVALID_COMMAND', 'A batch must contain distinct idempotency keys');
  }
  const results: FinanceResult[] = [];
  const fresh: typeof prepared = [];
  for (const item of prepared) {
    const { entry } = item;
    const operationId = operationIdFor(entry.idempotencyKey);
    const keySnap = await tx.get(db.collection('financeOperationKeys').doc(operationKeyId(entry.idempotencyKey)));
    const existing = await tx.get(ledger.doc(operationId));
    if (keySnap.exists) {
      const key = reconstruction(() => keySchema.parse(decodeTimestamps(keySnap.data()!, ['createdAt'])));
      if (key.idempotencyKey !== entry.idempotencyKey || key.requestHash !== economicHash(entry)) {
        throw new FinanceError('IDEMPOTENCY_CONFLICT');
      }
      if (key.operationId !== operationId || !existing.exists) throw new FinanceError('RECONSTRUCTION_REQUIRED');
      const persisted = reconstruction(() => readEntry(existing.data()!));
      if (economicHash(persisted) !== key.requestHash) throw new FinanceError('RECONSTRUCTION_REQUIRED');
      results.push({ operationId, entry: persisted, replayed: true });
    } else {
      if (existing.exists) throw new FinanceError('RECONSTRUCTION_REQUIRED', 'Unreserved operation ID already exists');
      fresh.push(item);
      results.push({ operationId, entry, replayed: false });
    }
  }
  // Identical retries do not change even projection timestamps.
  if (!fresh.length) return { results, write: () => {} };

  let state = stateSnap.exists
    ? reconstruction(() => stateSchema.parse(decodeTimestamps(stateSnap.data()!, ['updatedAt'])))
    : { schemaVersion: 1 as const, currency: 'EUR' as const, cashMinor: 0, commitmentMinor: 0,
      availableMinor: 0, updatedAt: now, lastOperationId: results[0].operationId };
  const periodSnaps = await tx.get(db.collection('fundPeriods'));
  const periods = new Map<string, FundPeriod>();
  for (const snap of periodSnaps.docs) {
    const period = reconstruction(() => fundPeriodSchema.parse(decodeTimestamps(snap.data(), periodTimestampFields)));
    if (snap.id !== period.periodId) throw new FinanceError('RECONSTRUCTION_REQUIRED');
    periods.set(snap.id, period);
  }
  if (!stateSnap.exists) {
    if (!(await tx.get(ledger.limit(1))).empty || periods.size) throw new FinanceError('RECONSTRUCTION_REQUIRED');
  } else {
    const lastEntry = await tx.get(ledger.doc(state.lastOperationId));
    if (!lastEntry.exists) throw new FinanceError('RECONSTRUCTION_REQUIRED');
    reconstruction(() => readEntry(lastEntry.data()!));
    const ordered = [...periods.values()].sort((a, b) => a.periodId.localeCompare(b.periodId));
    let cash = 0, commitment = 0;
    for (const period of ordered) {
      if (period.openingCashMinor !== cash || period.openingCommitmentMinor !== commitment) {
        throw new FinanceError('RECONSTRUCTION_REQUIRED');
      }
      cash = period.closingCashMinor; commitment = period.closingCommitmentMinor;
    }
    if (!ordered.length || cash !== state.cashMinor || commitment !== state.commitmentMinor) {
      throw new FinanceError('RECONSTRUCTION_REQUIRED');
    }
  }

  const awards = new Map<string, { projectId: string; outstanding: number }>();
  const reversed = new Set<string>();
  const touchedPeriods = new Set<string>();
  for (const { entry, original } of fresh) {
    if (entry.paymentId) {
      const payment = await tx.get(db.doc(`payments/${entry.paymentId}`));
      if (payment.exists) {
        const valid = reconstruction(() => paymentSchema.parse(decodeTimestamps(payment.data()!,
          ['createdAt', 'updatedAt', 'confirmedAt', 'membershipPeriodStart', 'membershipPeriodEnd'])));
        if (entry.uid !== undefined && entry.uid !== valid.uid) throw new FinanceError('PAYMENT_REFERENCE_MISMATCH');
      }
    }
    if (original) {
      if (reversed.has(original.operationId) || !(await tx.get(ledger.where('reversalOf', '==', original.operationId).limit(1))).empty) {
        throw new FinanceError('INVALID_REVERSAL', 'Original already reversed');
      }
      reversed.add(original.operationId);
    }
    const projectOperation = entry.operationType.startsWith('project_');
    if (entry.awardId !== undefined || (projectOperation && entry.projectId !== undefined)) {
      if (!entry.awardId || !entry.projectId) throw new FinanceError('INVALID_COMMAND', 'Award references require both awardId and projectId');
      let award = awards.get(entry.awardId);
      if (!award) {
        const history = await tx.get(ledger.where('awardId', '==', entry.awardId));
        let outstanding = BigInt(0);
        for (const snap of history.docs) {
          const prior = reconstruction(() => readEntry(snap.data()));
          if (prior.projectId !== entry.projectId) throw new FinanceError('AWARD_PROJECT_MISMATCH');
          outstanding += BigInt(prior.commitmentDeltaMinor);
        }
        award = { projectId: entry.projectId, outstanding: safeMinor(outstanding) };
        awards.set(entry.awardId, award);
      }
      if (award.projectId !== entry.projectId) throw new FinanceError('AWARD_PROJECT_MISMATCH');
      if ((entry.operationType === 'project_payout' || entry.operationType === 'project_commitment_release')
        && entry.amountMinor > award.outstanding) throw new FinanceError('INSUFFICIENT_OUTSTANDING');
      if (entry.operationType === 'project_commitment' && entry.amountMinor > state.availableMinor) {
        throw new FinanceError('INSUFFICIENT_FUNDS');
      }
      if (entry.operationType === 'project_payout' && entry.amountMinor > state.cashMinor) throw new FinanceError('INSUFFICIENT_FUNDS');
      award.outstanding = addMinor(award.outstanding, entry.commitmentDeltaMinor);
      if (award.outstanding < 0) throw new FinanceError('INSUFFICIENT_OUTSTANDING');
    }
    state = { ...state, cashMinor: addMinor(state.cashMinor, entry.cashDeltaMinor),
      commitmentMinor: addMinor(state.commitmentMinor, entry.commitmentDeltaMinor),
      updatedAt: now, lastOperationId: operationIdFor(entry.idempotencyKey) };
    state.availableMinor = safeMinor(BigInt(state.cashMinor) - BigInt(state.commitmentMinor));
    if (projectOperation && (state.cashMinor < 0 || state.commitmentMinor < 0 || state.availableMinor < 0)) {
      throw new FinanceError('INSUFFICIENT_FUNDS');
    }
    if (!periods.has(entry.periodId)) {
      const previous = [...periods.values()].filter(p => p.periodId < entry.periodId)
        .sort((a, b) => b.periodId.localeCompare(a.periodId))[0];
      // A missing month must never hide earlier unprojected ledger facts.
      let priorHistory = ledger.where('effectiveAt', '<', toAdminTimestamp(fundPeriodBounds(entry.periodId).startsAt));
      if (previous) priorHistory = priorHistory.where('effectiveAt', '>=', toAdminTimestamp(previous.endsAt));
      if (!(await tx.get(priorHistory.limit(1))).empty) throw new FinanceError('RECONSTRUCTION_REQUIRED');
      periods.set(entry.periodId, emptyPeriod(entry.periodId, previous, now));
    }
    for (const [id, period] of periods) {
      if (id >= entry.periodId) {
        periods.set(id, applyPeriodEntry(period, entry, now));
        touchedPeriods.add(id);
      }
    }
  }
  // Bounded fail-before-write, leaving room for the outer transaction's Payment writes.
  if (fresh.length * 2 + touchedPeriods.size + 1 > 450) throw new FinanceError('TRANSACTION_TOO_LARGE');
  let written = false;
  return { results, write: () => {
    if (written) throw new FinanceError('INVALID_COMMAND', 'Prepared writes may be applied only once');
    written = true;
    for (const { entry } of fresh) {
      const operationId = operationIdFor(entry.idempotencyKey);
      tx.create(db.collection('financeOperationKeys').doc(operationKeyId(entry.idempotencyKey)), {
        schemaVersion: 1, idempotencyKey: entry.idempotencyKey, requestHash: economicHash(entry), operationId,
        createdAt: toAdminTimestamp(now),
      });
      // Create-only: no update, set or delete on financialLedger.
      tx.create(ledger.doc(operationId), encodeTimestamps(entry, ledgerTimestampFields));
    }
    tx.set(stateRef, encodeTimestamps(stateSchema.parse(state), ['updatedAt']));
    for (const id of touchedPeriods) tx.set(db.doc(`fundPeriods/${id}`), encodeTimestamps(periods.get(id)!, periodTimestampFields));
  } };
}

export async function applyFinanceOperations(db: Firestore, commands: readonly FinanceCommand[], actor: FinanceActor): Promise<FinanceResult[]> {
  return db.runTransaction(async tx => {
    const prepared = await prepareFinanceOperations(tx, db, commands, actor);
    prepared.write();
    return prepared.results;
  }, { maxAttempts: 10 });
}

export async function applyFinanceOperation(db: Firestore, command: FinanceCommand, actor: FinanceActor): Promise<FinanceResult> {
  return (await applyFinanceOperations(db, [command], actor))[0];
}
