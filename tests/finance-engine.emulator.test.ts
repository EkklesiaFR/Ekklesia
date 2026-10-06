import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { calculateFundBalances, ledgerEntrySchema, type LedgerRecord } from '../src/lib/finance/ledger';
import { projectFundPeriod } from '../src/lib/finance/periods';
import { applyFinanceOperation, applyFinanceOperations, prepareFinanceOperations, type FinanceActor,
  type FinanceCommand } from '../src/lib/server/finance/finance-service';
import { decodeTimestamps, encodeTimestamps, toAdminTimestamp } from '../src/lib/server/finance/firestore-values';
import { operationIdFor, operationKeyId } from '../src/lib/server/finance/idempotency';

vi.mock('server-only', () => ({}));
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST
  || !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
  throw new Error('Finance engine tests require local Firestore AND Auth emulators; production prohibited');
}
const app = initializeApp({ projectId: 'demo-ekklesia-test' }, 'finance-engine-tests');
const db = getFirestore(app);
let env: RulesTestEnvironment;
const system: FinanceActor = { kind: 'system', service: 'emulator-economic-events' };
const admin: FinanceActor = { kind: 'admin', uid: 'admin' };
const at = (month = '2026-10') => ({ seconds: Date.parse(`${month}-05T10:00:00Z`) / 1000, nanoseconds: 123456789 });
function command(operationType: Exclude<FinanceCommand['operationType'], 'reversal'> = 'extra_support',
  amountMinor = 100, key: string = operationType, month = '2026-10'): Exclude<FinanceCommand, { operationType: 'reversal' }> {
  const base = { schemaVersion: 1 as const, operationType, currency: 'EUR' as const, allocation: 'common_fund' as const,
    amountMinor, periodId: month, effectiveAt: at(month), sourceType: 'emulator', sourceId: key, idempotencyKey: key,
    ...(operationType.startsWith('project_') ? { projectId: 'project-A', awardId: 'award-A' }
      : operationType === 'manual_adjustment' ? {} : { paymentId: 'payment-A' }),
    ...(operationType === 'membership_payment' ? { uid: 'member' } : {}) };
  return operationType === 'manual_adjustment'
    ? { ...base, operationType, adjustmentTarget: 'cash', adjustmentDirection: 'increase', reason: 'Verified correction' }
    : base as Exclude<FinanceCommand, { operationType: 'reversal' }>;
}
const apply = (c: FinanceCommand = command(), actor: FinanceActor = system) => applyFinanceOperation(db, c, actor);
// Same narrowly bounded emulator diagnostic as the existing vote suite.
// Do not turn arbitrary errors into acceptable business refusals.
const emulatorAborted = (error: { code?: number; details?: string }) => error.code === 10
  || (error.code === 3 && error.details === 'Transaction is invalid or closed.');
const state = async () => (await db.doc('financeState/current').get()).data()!;
async function economicSnapshot() {
  const names = ['financialLedger', 'financeOperationKeys', 'financeState', 'fundPeriods'];
  return Object.fromEntries(await Promise.all(names.map(async name => [name,
    (await db.collection(name).orderBy('__name__').get()).docs.map(d => ({ id: d.id, ...d.data() }))])));
}
async function assertReconciled() {
  const ledger = await db.collection('financialLedger').get();
  const records: LedgerRecord[] = ledger.docs.map(d => ({ operationId: d.id,
    entry: ledgerEntrySchema.parse(decodeTimestamps(d.data(), ['effectiveAt', 'recordedAt'])) }));
  const current = await state();
  expect(current).toMatchObject(calculateFundBalances(records));
  const periods = await db.collection('fundPeriods').get();
  for (const doc of periods.docs) {
    const stored = decodeTimestamps(doc.data(), ['startsAt', 'endsAt', 'calculatedAt']);
    expect(stored).toEqual(projectFundPeriod(records, doc.id, stored.calculatedAt as ReturnType<typeof at>));
  }
}

beforeAll(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-ekklesia-test', firestore: {
    host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8'),
  } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await db.doc('members/admin').set({ role: 'admin', status: 'active' });
});
afterAll(async () => { await env.cleanup(); await deleteApp(app); });

describe('persistent idempotence and create-only ledger', () => {
  it('creates exactly one operation and returns it unchanged for 20 replays / a lost response', async () => {
    // Discard the first response as though transport failed after the commit.
    await apply();
    const before = await economicSnapshot();
    for (let i = 0; i < 20; i++) {
      const replay = await apply();
      expect(replay).toMatchObject({ operationId: operationIdFor('extra_support'), replayed: true });
    }
    expect(await economicSnapshot()).toEqual(before);
    expect((await db.collection('financialLedger').get()).size).toBe(1);
    expect(await state()).toMatchObject({ cashMinor: 100, commitmentMinor: 0, availableMinor: 100 });
    await assertReconciled();
  });
  it('handles simultaneous identical commands with one economic effect', async () => {
    // Await every call even when one fails, so no transaction leaks into the next test.
    const settled = await Promise.allSettled(Array.from({ length: 6 }, () => apply()));
    expect((await db.collection('financialLedger').get()).size).toBe(1);
    expect((await db.collection('financeOperationKeys').get()).size).toBe(1);
    expect(await state()).toMatchObject({ cashMinor: 100 });
    const results = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') results.push(result.value);
      else {
        expect(emulatorAborted(result.reason), String(result.reason)).toBe(true);
        const beforeRetry = await economicSnapshot();
        results.push(await apply());
        expect(await economicSnapshot()).toEqual(beforeRetry);
      }
    }
    expect(new Set(results.map(r => r.operationId)).size).toBe(1);
    expect(results.filter(r => !r.replayed)).toHaveLength(1);
    expect((await db.collection('financialLedger').get()).size).toBe(1);
    expect((await db.collection('financeOperationKeys').get()).size).toBe(1);
    expect(await state()).toMatchObject({ cashMinor: 100 });
    await assertReconciled();
  });
  it.each([
    command('extra_support', 101, 'same'), command('refund', 100, 'same'),
    { ...command('extra_support', 100, 'same'), paymentId: 'other-payment' },
    { ...command('extra_support', 100, 'same'), effectiveAt: { ...at(), nanoseconds: 1 } },
  ])('rejects logical key reuse for a different economic command: %j', async different => {
    await apply(command('extra_support', 100, 'same'));
    const before = await economicSnapshot();
    await expect(apply(different)).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await economicSnapshot()).toEqual(before);
  });
  it('canonicalizes equivalent commands regardless of property insertion order', async () => {
    const c = command();
    const first = await apply(c);
    const second = await apply(Object.fromEntries(Object.entries(c).reverse()) as FinanceCommand);
    expect(second).toMatchObject({ operationId: first.operationId, replayed: true });
  });
  it('treats SDK Timestamp getters and equivalent TimestampValue maps as the same command', async () => {
    const first = await apply({ ...command(), uid: undefined, publicLabel: undefined, effectiveAt: toAdminTimestamp(at()) });
    const replay = await apply();
    expect(replay).toMatchObject({ operationId: first.operationId, replayed: true });
    expect(replay.entry).toEqual(first.entry);
    expect(replay.entry.effectiveAt).toEqual(at());
    expect((await apply({ ...command(), effectiveAt: toAdminTimestamp(at()) })).replayed).toBe(true);
  });
  it('does not alias Firestore-unsafe keys and never overwrites a deterministic ID collision', async () => {
    await apply(command('extra_support', 100, 'payment/a:b'));
    await apply(command('extra_support', 100, 'payment_a:b'));
    expect((await db.collection('financialLedger').get()).size).toBe(2);
    await db.doc(`financialLedger/${operationIdFor('collision')}`).create({ sentinel: 'unreserved existing record' });
    const before = await economicSnapshot();
    await expect(apply(command('extra_support', 100, 'collision'))).rejects.toMatchObject({ code: 'RECONSTRUCTION_REQUIRED' });
    expect(await economicSnapshot()).toEqual(before);
  });
  it('detects a corrupt key-to-ledger association rather than overwriting it', async () => {
    await apply();
    await db.doc(`financeOperationKeys/${operationKeyId('extra_support')}`).update({ operationId: 'missing' });
    const before = await economicSnapshot();
    await expect(apply()).rejects.toMatchObject({ code: 'RECONSTRUCTION_REQUIRED' });
    expect(await economicSnapshot()).toEqual(before);
  });
  it('uses create exclusively for ledger writes, including corrections', async () => {
    const c = command('manual_adjustment');
    await db.runTransaction(async tx => {
      const plan = await prepareFinanceOperations(tx, db, [c], admin);
      const create = vi.spyOn(tx, 'create');
      const set = vi.spyOn(tx, 'set');
      const update = vi.spyOn(tx, 'update');
      const remove = vi.spyOn(tx, 'delete');
      plan.write();
      expect(create.mock.calls.filter(([ref]) => ref.parent.id === 'financialLedger')).toHaveLength(1);
      expect(set.mock.calls.some(([ref]) => ref.parent.id === 'financialLedger')).toBe(false);
      expect(update).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
      expect(() => plan.write()).toThrow(/only once/);
    });
  });
});

describe('authorization is derived from a trusted actor and a transactional member read', () => {
  it.each(['pending', 'blocked', 'revoked', 'disabled'])('refuses an admin with status %s', async status => {
    await db.doc('members/admin').set({ role: 'admin', status });
    await expect(apply(command('manual_adjustment'), admin)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect((await db.collection('financialLedger').get()).empty).toBe(true);
  });
  it.each(['member', 'unknown'])('refuses role %s even when active', async role => {
    await db.doc('members/admin').set({ role, status: 'active' });
    await expect(apply(command('manual_adjustment'), admin)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('refuses an absent admin, an isAdmin assertion and cross-kind actors', async () => {
    await expect(apply(command('manual_adjustment'), { kind: 'admin', uid: 'missing' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(apply(command('manual_adjustment'), { ...admin, isAdmin: true } as FinanceActor)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(apply(command(), admin)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(apply(command('manual_adjustment'), system)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it('allows an active admin and derives the author without trusting caller fields or deltas', async () => {
    const result = await apply(command('manual_adjustment'), admin);
    expect(result.entry.createdBy).toBe('admin:admin');
    expect((await apply()).entry.createdBy).toBe('system:emulator-economic-events');
    for (const patch of [{ createdBy: 'admin:forged' }, { recordedAt: at() }, { cashDeltaMinor: 999 }]) {
      await expect(apply({ ...command(), ...patch } as FinanceCommand)).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    }
  });
  it('rechecks an admin on replay after revocation', async () => {
    const c = command('manual_adjustment');
    await apply(c, admin);
    await db.doc('members/admin').update({ status: 'revoked' });
    await expect(apply(c, admin)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
  it.each(['reason', 'sourceType', 'sourceId', 'idempotencyKey'] as const)('requires an explicit nonempty %s for corrections', async field => {
    await expect(apply({ ...command('manual_adjustment'), [field]: ' ' } as FinanceCommand, admin))
      .rejects.toMatchObject({ code: 'INVALID_COMMAND' });
  });
});

describe('funded commitments and outstanding by award', () => {
  it('accepts a funded commitment and refuses the next unfunded one atomically', async () => {
    await apply(command('extra_support', 1000));
    await apply(command('project_commitment', 700), admin);
    const before = await economicSnapshot();
    await expect(apply(command('project_commitment', 301, 'over'), admin)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    expect(await economicSnapshot()).toEqual(before);
    expect(await state()).toMatchObject({ cashMinor: 1000, commitmentMinor: 700, availableMinor: 300 });
  });
  it('serializes simultaneous 700 commitments against 1000 available', async () => {
    await apply(command('extra_support', 1000));
    const results = await Promise.allSettled(['A', 'B'].map(id => apply({ ...command('project_commitment', 700, id), awardId: `award-${id}` }, admin)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    const failure = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    expect(await state()).toMatchObject({ cashMinor: 1000, commitmentMinor: 700, availableMinor: 300 });
    expect((await db.collection('financialLedger').get()).size).toBe(2);
    if (failure.reason.code !== 'INSUFFICIENT_FUNDS') {
      expect(emulatorAborted(failure.reason), String(failure.reason)).toBe(true);
      const index = results.findIndex(r => r.status === 'rejected');
      const id = ['A', 'B'][index];
      const beforeRetry = await economicSnapshot();
      await expect(apply({ ...command('project_commitment', 700, id), awardId: `award-${id}` }, admin))
        .rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
      expect(await economicSnapshot()).toEqual(beforeRetry);
    }
    await assertReconciled();
  });
  it('accepts payout <= outstanding and keeps the already-reserved available unchanged', async () => {
    await apply(command('extra_support', 1000));
    await apply(command('project_commitment', 700), admin);
    await apply(command('project_payout', 200), admin);
    expect(await state()).toMatchObject({ cashMinor: 800, commitmentMinor: 500, availableMinor: 300 });
    const before = await economicSnapshot();
    await expect(apply(command('project_payout', 501, 'over'), admin)).rejects.toMatchObject({ code: 'INSUFFICIENT_OUTSTANDING' });
    expect(await economicSnapshot()).toEqual(before);
    await apply(command('project_payout', 500, 'rest'), admin);
    expect(await state()).toMatchObject({ cashMinor: 300, commitmentMinor: 0, availableMinor: 300 });
    await assertReconciled();
  });
  it('requires enough cash even if outstanding remains after an exceptional correction', async () => {
    await apply(command('extra_support', 1000));
    await apply(command('project_commitment', 700), admin);
    await apply({ ...command('manual_adjustment', 900), adjustmentDirection: 'decrease' } as FinanceCommand, admin);
    await expect(apply(command('project_payout', 200), admin)).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });
  it('releases at most the remaining outstanding and increases available', async () => {
    await apply(command('extra_support', 1000));
    await apply(command('project_commitment', 700), admin);
    await apply(command('project_commitment_release', 200), admin);
    expect(await state()).toMatchObject({ cashMinor: 1000, commitmentMinor: 500, availableMinor: 500 });
    await expect(apply(command('project_commitment_release', 501, 'over'), admin)).rejects.toMatchObject({ code: 'INSUFFICIENT_OUTSTANDING' });
    await apply(command('project_commitment_release', 500, 'rest'), admin);
    await assertReconciled();
  });
  it.each(['project_commitment', 'project_commitment_release', 'project_payout'] as const)('binds an award to its initial project for %s', async type => {
    await apply(command('extra_support', 1000));
    await apply(command('project_commitment', 700), admin);
    await expect(apply({ ...command(type, 100, 'wrong-project'), projectId: 'project-B' }, admin))
      .rejects.toMatchObject({ code: 'AWARD_PROJECT_MISMATCH' });
  });
  it('does not permit release or payout for an award with no outstanding', async () => {
    await apply(command('extra_support', 1000));
    for (const type of ['project_payout', 'project_commitment_release'] as const) {
      await expect(apply(command(type), admin)).rejects.toMatchObject({ code: 'INSUFFICIENT_OUTSTANDING' });
    }
  });
  it('keeps the award-to-project binding after full release', async () => {
    await apply(command('extra_support', 1000));
    await apply(command('project_commitment', 700), admin);
    await apply(command('project_commitment_release', 700), admin);
    await expect(apply({ ...command('project_commitment', 100, 'rebind'), projectId: 'project-B' }, admin))
      .rejects.toMatchObject({ code: 'AWARD_PROJECT_MISMATCH' });
  });
  it('serializes a payout and a release that together exceed award outstanding', async () => {
    await apply(command('extra_support', 1000));
    await apply(command('project_commitment', 700), admin);
    const results = await Promise.allSettled([
      apply(command('project_payout', 500), admin), apply(command('project_commitment_release', 500), admin),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect((await state()).commitmentMinor).toBe(200);
    const failure = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
    if (failure.reason.code !== 'INSUFFICIENT_OUTSTANDING') {
      expect(emulatorAborted(failure.reason), String(failure.reason)).toBe(true);
      const type = results[0].status === 'rejected' ? 'project_payout' : 'project_commitment_release';
      const beforeRetry = await economicSnapshot();
      await expect(apply(command(type, 500), admin)).rejects.toMatchObject({ code: 'INSUFFICIENT_OUTSTANDING' });
      expect(await economicSnapshot()).toEqual(beforeRetry);
    }
    await assertReconciled();
  });
});

describe('transactional periods, timestamps and reconstruction guards', () => {
  it('creates missing periods from the previous closing, propagates late deltas and preserves future categories', async () => {
    await apply(command('extra_support', 1000, 'sept', '2026-09'));
    await apply(command('extra_support', 500, 'oct', '2026-10'));
    await apply(command('extra_support', 200, 'dec', '2026-12'));
    await apply(command('extra_support', 100, 'late', '2026-09'));
    expect((await db.doc('fundPeriods/2026-09').get()).data()).toMatchObject({ openingCashMinor: 0, closingCashMinor: 1100, supportIncomeMinor: 1100 });
    expect((await db.doc('fundPeriods/2026-10').get()).data()).toMatchObject({ openingCashMinor: 1100, closingCashMinor: 1600, supportIncomeMinor: 500 });
    expect((await db.doc('fundPeriods/2026-12').get()).data()).toMatchObject({ openingCashMinor: 1600, closingCashMinor: 1800, supportIncomeMinor: 200 });
    await apply(command('extra_support', 50, 'nov', '2026-11'));
    expect((await db.doc('fundPeriods/2026-11').get()).data()).toMatchObject({ openingCashMinor: 1600, closingCashMinor: 1650, supportIncomeMinor: 50 });
    expect((await db.doc('fundPeriods/2026-12').get()).data()).toMatchObject({ openingCashMinor: 1650, closingCashMinor: 1850, supportIncomeMinor: 200 });
    await assertReconciled();
  });
  it('creates an older month with zero opening only when no earlier history exists', async () => {
    await apply(command('extra_support', 500, 'oct', '2026-10'));
    await apply(command('extra_support', 1000, 'sept', '2026-09'));
    await assertReconciled();
  });
  it('persists real Admin Timestamps in ledger, key, state and periods, preserving nanoseconds', async () => {
    const result = await apply();
    const stored = (await db.doc(`financialLedger/${result.operationId}`).get()).data()!;
    expect(stored.effectiveAt).toBeInstanceOf(Timestamp);
    expect(stored.effectiveAt.nanoseconds).toBe(123456000);
    expect(stored.timestampRemainders).toEqual({ effectiveAt: 789 });
    expect(decodeTimestamps(stored, ['effectiveAt', 'recordedAt']).effectiveAt).toEqual(at());
    expect(stored.recordedAt).toBeInstanceOf(Timestamp);
    expect((await state()).updatedAt).toBeInstanceOf(Timestamp);
    expect((await db.doc(`financeOperationKeys/${operationKeyId('extra_support')}`).get()).data()!.createdAt).toBeInstanceOf(Timestamp);
    const period = (await db.doc('fundPeriods/2026-10').get()).data()!;
    for (const field of ['startsAt', 'endsAt', 'calculatedAt']) expect(period[field]).toBeInstanceOf(Timestamp);
  });
  it('refuses to initialize state over existing ledger facts', async () => {
    await apply();
    await db.doc('financeState/current').delete();
    const before = await economicSnapshot();
    await expect(apply(command('extra_support', 50, 'next'))).rejects.toMatchObject({ code: 'RECONSTRUCTION_REQUIRED' });
    expect(await economicSnapshot()).toEqual(before);
  });
  it('refuses inconsistent state, a missing projection, and simple-map timestamp data', async () => {
    await apply();
    const originalState = await state();
    await db.doc('financeState/current').update({ availableMinor: 999 });
    await expect(apply(command('extra_support', 50, 'next'))).rejects.toMatchObject({ code: 'RECONSTRUCTION_REQUIRED' });
    await db.doc('financeState/current').set(originalState);
    await db.doc('fundPeriods/2026-10').delete();
    await expect(apply(command('extra_support', 50, 'next'))).rejects.toMatchObject({ code: 'RECONSTRUCTION_REQUIRED' });
    await db.doc('financeState/current').update({ updatedAt: at() });
    await expect(apply(command('extra_support', 50, 'next'))).rejects.toMatchObject({ code: 'RECONSTRUCTION_REQUIRED' });
  });
  it('never invents a zero opening when an earlier unprojected ledger fact exists', async () => {
    const first = await apply();
    // Simulate an out-of-service/imported historical fact without its projection.
    await db.doc('financialLedger/imported-august').create(encodeTimestamps({ ...first.entry,
      idempotencyKey: 'imported', periodId: '2026-08', effectiveAt: at('2026-08') }, ['effectiveAt', 'recordedAt']));
    const before = await economicSnapshot();
    await expect(apply(command('extra_support', 50, 'sept', '2026-09'))).rejects.toMatchObject({ code: 'RECONSTRUCTION_REQUIRED' });
    expect(await economicSnapshot()).toEqual(before);
  });
  it('rejects monetary overflow with no partial reservation or ledger write', async () => {
    await apply(command('extra_support', Number.MAX_SAFE_INTEGER));
    const before = await economicSnapshot();
    await expect(apply(command('extra_support', 1, 'overflow'))).rejects.toThrow(/safe integer/);
    expect(await economicSnapshot()).toEqual(before);
  });
});

function payment(uid = 'member') {
  return { schemaVersion: 1, uid, currency: 'EUR', grossAmountMinor: 600, membershipAmountMinor: 100,
    supportAmountMinor: 500, feeAmountMinor: 25, refundedAmountMinor: 0, status: 'confirmed',
    createdAt: toAdminTimestamp(at()), updatedAt: toAdminTimestamp(at()), confirmedAt: toAdminTimestamp(at()),
    membershipPeriodStart: toAdminTimestamp(at()), membershipPeriodEnd: toAdminTimestamp(at('2026-11')) };
}

describe('Payment references and composition without nested transactions', () => {
  it.each(['membership_payment', 'extra_support', 'payment_fee', 'refund'] as const)('checks optional existing Payment identity for %s', async type => {
    await db.doc('payments/payment-A').set(payment('other-member'));
    await expect(apply({ ...command(type), uid: 'member' })).rejects.toMatchObject({ code: 'PAYMENT_REFERENCE_MISMATCH' });
    expect((await db.collection('financialLedger').get()).empty).toBe(true);
    await db.doc('payments/payment-A').set(payment());
    await apply({ ...command(type), uid: 'member' });
  });
  it('commits Payment and several entries together, and rolls all of them back on outer failure', async () => {
    const commands = [command('membership_payment'), command('extra_support', 500), command('payment_fee', 25)];
    let callbacks = 0;
    await db.runTransaction(async tx => {
      callbacks++;
      const prepared = await prepareFinanceOperations(tx, db, commands, system);
      tx.create(db.doc('payments/payment-A'), payment());
      prepared.write();
    });
    expect(callbacks).toBe(1);
    expect(await state()).toMatchObject({ cashMinor: 575, commitmentMinor: 0, availableMinor: 575 });
    expect((await db.collection('financialLedger').get()).size).toBe(3);
    const before = await economicSnapshot();
    await expect(db.runTransaction(async tx => {
      const prepared = await prepareFinanceOperations(tx, db, [command('extra_support', 50, 'abort')], system);
      tx.update(db.doc('payments/payment-A'), { supportAmountMinor: 550, grossAmountMinor: 650 });
      prepared.write();
      throw new Error('Outer workflow aborted');
    })).rejects.toThrow('Outer workflow aborted');
    expect(await economicSnapshot()).toEqual(before);
    expect((await db.doc('payments/payment-A').get()).data()!.grossAmountMinor).toBe(600);
    const replay = await applyFinanceOperations(db, commands, system);
    expect(replay.every(r => r.replayed)).toBe(true);
    await assertReconciled();
  });
  it('rejects a batch with one unfunded command without committing earlier valid commands', async () => {
    await expect(applyFinanceOperations(db, [command('manual_adjustment', 100), command('project_commitment', 101)], admin))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    expect((await db.collection('financialLedger').get()).size).toBe(0);
    expect((await db.collection('financeOperationKeys').get()).size).toBe(0);
    expect((await db.doc('financeState/current').get()).exists).toBe(false);
  });
});

describe('append-only reversals', () => {
  const reverse = (operationId: string, key = 'reverse'): FinanceCommand => ({ operationType: 'reversal',
    reversalOf: operationId, periodId: '2026-10', effectiveAt: at(), reason: 'Duplicate entry corrected',
    sourceType: 'admin-correction', sourceId: key, idempotencyKey: key });
  it('appends an exact reversal, replays it and refuses another reversal of the same original', async () => {
    const first = await apply(command('membership_payment'));
    const original = (await db.doc(`financialLedger/${first.operationId}`).get()).data();
    const reversal = await apply(reverse(first.operationId), admin);
    expect(reversal.entry).toMatchObject({ reversalOf: first.operationId, paymentId: 'payment-A', uid: 'member', cashDeltaMinor: -100 });
    expect((await db.doc(`financialLedger/${first.operationId}`).get()).data()).toEqual(original);
    expect((await apply(reverse(first.operationId), admin)).operationId).toBe(reversal.operationId);
    await expect(apply(reverse(first.operationId, 'another'), admin)).rejects.toMatchObject({ code: 'INVALID_REVERSAL' });
    await expect(apply(reverse(reversal.operationId, 'chain'), admin)).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    expect((await db.collection('financialLedger').get()).size).toBe(2);
    await assertReconciled();
  });
  it('includes reversals in award outstanding and forbids reversing a consumed commitment', async () => {
    await apply(command('extra_support', 1000));
    const commitment = await apply(command('project_commitment', 700), admin);
    const payout = await apply(command('project_payout', 200), admin);
    await expect(apply(reverse(commitment.operationId), admin)).rejects.toMatchObject({ code: 'INSUFFICIENT_OUTSTANDING' });
    await apply(reverse(payout.operationId, 'reverse-payout'), admin);
    await apply(reverse(commitment.operationId), admin);
    expect(await state()).toMatchObject({ cashMinor: 1000, commitmentMinor: 0, availableMinor: 1000 });
    await assertReconciled();
  });
  it('refuses caller-supplied reversalOf on ordinary adjustments', async () => {
    await expect(apply({ ...command('manual_adjustment'), reversalOf: 'forged' } as unknown as FinanceCommand, admin))
      .rejects.toMatchObject({ code: 'INVALID_COMMAND' });
  });
});
