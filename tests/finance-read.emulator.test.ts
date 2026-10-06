import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createLedgerEntry, createReversal } from '../src/lib/finance/ledger';
import { encodeTimestamps } from '../src/lib/server/finance/firestore-values';
import { readPublicFinance } from '../src/lib/server/finance/finance-read-service';
import { GET } from '../src/app/api/public/finance/route';

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/firebase/admin', () => ({ getAdminDb: () => db }));
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
  || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Local emulators required; production prohibited');
const app = initializeApp({ projectId: 'demo-ekklesia-test' }, 'finance-read-tests');
const db = getFirestore(app);
const now = { seconds: Date.parse('2026-10-06T00:00:00Z') / 1000, nanoseconds: 123456789 };
const state = { schemaVersion: 1, currency: 'EUR', cashMinor: 800, commitmentMinor: 300, availableMinor: 500,
  updatedAt: new Timestamp(now.seconds, 123456000), lastOperationId: 'payout' };
const support = createLedgerEntry({ schemaVersion: 1, currency: 'EUR', operationType: 'extra_support',
  amountMinor: 1000, allocation: 'common_fund', periodId: '2026-10', effectiveAt: now, recordedAt: now,
  paymentId: 'private-payment', uid: 'private-uid', sourceType: 'private-provider', sourceId: 'private-source',
  idempotencyKey: 'private-key', createdBy: 'private-author', publicLabel: 'Soutien à la cagnotte' });
const { cashDeltaMinor: _cash, commitmentDeltaMinor: _commitment, ...supportInput } = support;
const commitment = createLedgerEntry({ ...supportInput, operationType: 'project_commitment', amountMinor: 500,
  idempotencyKey: 'private-commitment', projectId: 'private-project', awardId: 'private-award' });
const payout = createLedgerEntry({ ...supportInput, operationType: 'project_payout', amountMinor: 200,
  projectId: 'private-project', awardId: 'private-award', idempotencyKey: 'private-payout' });
async function seed() {
  await db.doc('financeState/current').set(state);
  for (const [id, entry] of [['support', support], ['commitment', commitment], ['payout', payout]] as const) {
    await db.doc(`financialLedger/${id}`).set(encodeTimestamps(entry, ['effectiveAt', 'recordedAt']));
  }
}
async function snapshot() {
  return Promise.all(['financeState', 'financialLedger', 'fundPeriods', 'financeOperationKeys'].map(async name =>
    (await db.collection(name).get()).docs.map(doc => ({ id: doc.id, ...doc.data() }))));
}
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-ekklesia-test/databases/(default)/documents`, { method: 'DELETE' });
});
afterAll(async () => { await deleteApp(app); });

describe('public financial reads', () => {
  it('returns real zero only when all three collections are empty, without writing', async () => {
    const before = await snapshot();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'empty', currency: 'EUR', cashMinor: 0,
      commitmentMinor: 0, availableMinor: 0, totalPaidToProjectsMinor: 0, entries: [] });
    expect(await snapshot()).toStrictEqual(before);
  });
  it('returns exact balances, net payouts and only public registry fields', async () => {
    await seed();
    const before = await snapshot();
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(data).toMatchObject({ status: 'active', cashMinor: 800, commitmentMinor: 300,
      availableMinor: 500, totalPaidToProjectsMinor: 200 });
    expect(data.availableMinor).toBe(data.cashMinor - data.commitmentMinor);
    expect(data.entries).toHaveLength(3);
    for (const entry of data.entries) expect(Object.keys(entry).sort()).toEqual(['amountMinor', 'category', 'date', 'publicLabel']);
    expect(data.entries.find((entry: { category: string }) => entry.category === 'project_payout').amountMinor).toBe(-200);
    expect(data.entries[0].date).toBe('2026-10-06T00:00:00.123456789Z');
    expect(JSON.stringify(data)).not.toContain('private-');
    expect(await snapshot()).toStrictEqual(before);
  });
  it.each(['financialLedger', 'fundPeriods'])('refuses false zero when %s exists without state', async collection => {
    await db.collection(collection).doc('historical').set({ historical: true });
    const before = await snapshot();
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
    expect(await snapshot()).toStrictEqual(before);
  });
  it.each([
    { availableMinor: 501 }, { currency: 'USD' }, { cashMinor: 0.5 }, { schemaVersion: 2 },
    { updatedAt: { seconds: now.seconds, nanoseconds: 0 } },
  ])('refuses an invalid state contract %j', async patch => {
    await db.doc('financeState/current').set({ ...state, ...patch });
    expect(await readPublicFinance(db)).toEqual({ status: 'unavailable' });
  });
  it('subtracts an annulled payout from total paid without disclosing reversal references', async () => {
    await seed();
    const reversal = createReversal({ operationId: 'payout', entry: payout }, {
      effectiveAt: now, recordedAt: now, periodId: '2026-10', sourceType: 'correction', sourceId: 'private-reversal',
      idempotencyKey: 'private-reversal', createdBy: 'private-admin', reason: 'Private audit reason' });
    await db.doc('financialLedger/reversal').set(encodeTimestamps(reversal, ['effectiveAt', 'recordedAt']));
    await db.doc('financeState/current').set({ ...state, cashMinor: 1000, commitmentMinor: 500 });
    const data = await readPublicFinance(db);
    expect(data).toMatchObject({ status: 'active', totalPaidToProjectsMinor: 0 });
    expect(JSON.stringify(data)).not.toContain('Private audit reason');
    if (data.status !== 'unavailable') expect(data.entries.find(entry => entry.category === 'reversal'))
      .toMatchObject({ amountMinor: 200, publicLabel: null });
  });
  it('returns controlled unavailable when ledger validation fails', async () => {
    await db.doc('financeState/current').set(state);
    await db.doc('financialLedger/invalid').set({ uid: 'private' });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'unavailable' });
  });
});
