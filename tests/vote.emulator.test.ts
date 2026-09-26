import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { openVote, submitBallot, publishVote } from '../src/lib/server/vote-service';
import { computeSchulzeResults } from '../src/lib/tally';
import { projectsForVote } from '../src/lib/vote-projects';
import { contentHash } from '../src/lib/server/proposal-snapshot';
import type { Vote } from '../src/types';

const projectId = 'demo-ekklesia-test';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Tests require Firestore AND Auth emulators; production access prohibited');
}
const app = initializeApp({ projectId }, 'vote-tests');
const db = getFirestore(app);
vi.mock('../src/lib/firebase/admin', () => ({ getAdminDb: () => db, getAdminApp: () => ({ auth: () => getAuth(app) }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('server-only', () => ({}));
vi.mock('../src/lib/server/notifications', () => ({ sendVoteCreatedNotifications: vi.fn(), sendVoteLockedNotifications: vi.fn() }));
const { POST: ballotPOST } = await import('../src/app/api/assemblies/[assemblyId]/votes/[voteId]/ballots/route');
const { POST: openPOST } = await import('../src/app/api/admin/assemblies/[assemblyId]/votes/[voteId]/open/route');
const { POST: publishPOST } = await import('../src/app/api/admin/assemblies/[assemblyId]/votes/[voteId]/publish/route');
const { GET: pdfGET } = await import('../src/app/api/pv/[assemblyId]/[voteId]/pdf/route');
const { GET: verifyGET } = await import('../src/app/api/verify/route');
const { computeFinalSeal } = await import('../src/lib/pv/seal');
const { decisionForSeal } = await import('../src/lib/vote-decision');
let env: RulesTestEnvironment;
const voteRef = (v = 'v') => db.doc(`assemblies/a/votes/${v}`);
const ballotRef = (u = 'm', v = 'v') => voteRef(v).collection('ballots').doc(u);
const member = (u: string, status = 'active', role = 'member') => db.doc(`members/${u}`).set({ status, role });
const submit = (u = 'm', ranking: unknown = ['A'], v = 'v') => submitBallot(db, u, 'a', v, ranking);
const publish = (v = 'v') => publishVote(db, 'admin', 'a', v);
// The real emulator can report a closed transaction as INVALID_ARGUMENT after lock timeout.
// Accept only that precise diagnostic (or ABORTED), never arbitrary validation errors.
const transactionAborted = (error: { code?: number; details?: string }) => error.code === 10 ||
  (error.code === 3 && error.details === 'Transaction is invalid or closed.');

beforeAll(async () => {
  process.env.PV_SALT = 'emulator-only-seal-secret';
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await Promise.all([member('admin', 'active', 'admin'), member('m'), member('n'),
    db.doc('assemblies/a').set({ state: 'open', activeVoteId: 'v' }),
    voteRef().set({ state: 'open', projectIds: ['A', 'B', 'C'], question: 'Question', quorumPct: 60 }),
    ...['A', 'B', 'C'].map(id => db.doc(`projects/${id}`).set({ title: `Project ${id}`, summary: `Summary ${id}`, budget: '100 €' }))]);
});
afterAll(async () => { await env.cleanup(); await deleteApp(app); });

describe('server transactions on real Firestore', () => {
  it('rejects unauthenticated, absent, inactive and unknown-role members, including active mirrors', async () => {
    await expect(submit('')).rejects.toMatchObject({ status: 401 });
    await expect(submit('absent')).rejects.toMatchObject({ status: 403 });
    for (const status of ['pending', 'blocked', 'revoked']) {
      await member('m', status);
      await db.doc('assemblies/a/members/m').set({ status: 'active', role: 'admin' });
      await expect(submit()).rejects.toMatchObject({ status: 403 });
    }
    await member('m', 'active', 'other');
    await expect(submit()).rejects.toMatchObject({ status: 403 });
    expect((await ballotRef().get()).exists).toBe(false);
  });
  it('rejects absent, draft, locked and expired votes, without creating a missing vote', async () => {
    await expect(submit('m', ['A'], 'missing')).rejects.toMatchObject({ status: 404 });
    expect((await voteRef('missing').get()).exists).toBe(false);
    for (const state of ['draft', 'locked']) {
      await voteRef().update({ state });
      await expect(submit()).rejects.toMatchObject({ status: 409 });
    }
    await voteRef().update({ state: 'open', deadlineEnforced: true, closesAt: Timestamp.fromMillis(1) });
    await expect(submit()).rejects.toMatchObject({ status: 409 });
    await voteRef().update({ closesAt: 'malformed' });
    await expect(submit()).rejects.toMatchObject({ status: 409 });
  });
  it('preserves indicative historical dates and permits new active members; suspension preserves their previous ballot', async () => {
    await voteRef().update({ closesAt: Timestamp.fromMillis(1), eligibleCountAtOpen: 1 });
    await member('new'); await submit('new');
    await member('new', 'blocked');
    await expect(submit('new', ['B'])).rejects.toMatchObject({ status: 403 });
    expect((await ballotRef('new').get()).data()?.ranking).toEqual(['A']);
  });
  it('freezes new electorates and quorum reference; late activation excluded, suspension blocks changes only', async () => {
    await db.doc('assemblies/a').update({ state: 'draft', activeVoteId: null });
    await voteRef().update({ state: 'draft', eligibilityPolicy: 'snapshot-active-v1', rulesVersion: 1,
      deadlineEnforced: true, closesAt: Timestamp.fromMillis(Date.now() + 60000) });
    await member('late', 'pending');
    await openVote(db, 'admin', 'a', 'v');
    const electorate = (await voteRef().collection('electorate').doc('snapshot').get()).data();
    const eligible = (await voteRef().get()).data()?.eligibleCountAtOpen;
    expect(eligible).toBe(3);
    await member('late');
    await expect(submit('late')).rejects.toMatchObject({ status: 403 });
    await submit('m');
    await member('m', 'blocked');
    await expect(submit('m', ['B'])).rejects.toMatchObject({ status: 403 });
    expect((await ballotRef('m').get()).data()?.ranking).toEqual(['A']);
    expect((await voteRef().get()).data()?.eligibleCountAtOpen).toBe(eligible);
    expect((await voteRef().collection('electorate').doc('snapshot').get()).data()).toEqual(electorate);
    await voteRef().update({ closesAt: Timestamp.fromMillis(1) }); // Test-only clock boundary fixture.
    await expect(submit('n')).rejects.toMatchObject({ status: 409 });
    expect((await publish()).results).toMatchObject({ total: 1 });
    expect((await voteRef().get()).data()?.eligibleCountAtOpen).toBe(3);
  });
  it('never reconstructs a missing electorate for a new open vote', async () => {
    await voteRef().update({ eligibilityPolicy: 'snapshot-active-v1' });
    await expect(submit()).rejects.toMatchObject({ status: 409 });
    expect((await voteRef().collection('electorate').doc('snapshot').get()).exists).toBe(false);
  });
  it.each([null, [], 'A', [1], ['X'], ['A', 'A'], [['A']], [{ id: 'A' }], ['A', 'B', 'C', 'A']])('rejects malformed ranking %j', async ranking => {
    await expect(submit('m', ranking)).rejects.toMatchObject({ status: 400 });
    expect((await ballotRef().get()).exists).toBe(false);
  });
  async function concurrentDeposits(uids: string[]) {
    const before = (await voteRef().get()).data()!;
    const previous = (await voteRef().collection('ballots').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const outcomes = await Promise.allSettled(uids.map(u => submit(u)));
    // A lock expiry may reject a request; it must not leave a partial counter/ballot.
    const stored = await voteRef().collection('ballots').get();
    const vote = (await voteRef().get()).data()!;
    if (outcomes.some(r => r.status === 'fulfilled')) expect(vote.ballotCount).toBe(stored.size);
    else {
      expect(vote).toEqual(before);
      expect(stored.docs.map(d => ({ id: d.id, ...d.data() }))).toEqual(previous);
    }
    for (const [index, outcome] of outcomes.entries()) {
      if (outcome.status !== 'rejected') continue;
      expect(transactionAborted(outcome.reason), String(outcome.reason)).toBe(true);
      await submit(uids[index]); // Explicit client retry, after inspecting committed state.
    }
  }
  it('accepts partial ballots, replaces one ballot, preserves castAt and counts double submissions once', async () => {
    await concurrentDeposits(['m', 'm']);
    const castAt = (await ballotRef().get()).data()?.castAt;
    await submit('m', ['B', 'A']);
    expect((await ballotRef().get()).data()).toMatchObject({ ranking: ['B', 'A'], castAt });
    expect((await voteRef().get()).data()?.ballotCount).toBe(1);
  });
  it('repairs missing or stale historical counts transactionally during simultaneous deposits', async () => {
    await voteRef().update({ ballotCount: 99 });
    await ballotRef('old').set({ ranking: ['A'] });
    await concurrentDeposits(['m', 'n', 'admin', 'm', 'n']);
    expect((await voteRef().get()).data()).toMatchObject({ ballotCount: 4, counterVersion: 1 });
    expect((await voteRef().collection('ballots').get()).size).toBe(4);
  });
  it('serializes deposits with publication; locked ballots exactly match tally count', async () => {
    await submit();
    const outcomes = await Promise.allSettled([submit('n'), publish(), submit('m', ['B'])]);
    if (outcomes[1].status === 'rejected') {
      // Firestore may exhaust its bounded automatic retries under contention.
      // Inspect the rollback before an explicit retry, including the emulator's closed-tx error.
      expect(transactionAborted(outcomes[1].reason), String(outcomes[1].reason)).toBe(true);
      const aborted = (await voteRef().get()).data()!;
      expect(aborted.state).toBe('open');
      expect(aborted.results).toBeUndefined();
      expect((await db.doc('assemblies/a/public/lastResult').get()).exists).toBe(false);
      await publish();
    }
    for (const outcome of [outcomes[0], outcomes[2]]) {
      if (outcome.status === 'rejected') {
        expect(outcome.reason.status === 409 || transactionAborted(outcome.reason), String(outcome.reason)).toBe(true);
      }
    }
    const snapshot = (await voteRef().get()).data()!;
    expect(snapshot.state).toBe('locked');
    expect(snapshot.results.total).toBe((await voteRef().collection('ballots').get()).size);
    const stored = (await voteRef().collection('ballots').get()).docs.map(d => d.data() as { ranking: string[] });
    expect(snapshot.results.fullRanking).toEqual(computeSchulzeResults(['A', 'B', 'C'], stored).ranking);
    await expect(submit('n')).rejects.toMatchObject({ status: 409 });
    expect((await voteRef().get()).data()).toEqual(snapshot);
  });
  it('double publication is idempotent, including retry after a lost response', async () => {
    await submit();
    const outcomes = await Promise.all([publish(), publish()]);
    expect(outcomes.filter(r => !r.alreadyLocked)).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(outcomes[0].results))).toEqual(JSON.parse(JSON.stringify(outcomes[1].results)));
    const initial = (await voteRef().get()).data();
    const publicInitial = (await db.doc('assemblies/a/public/lastResult').get()).data();
    expect((await publish()).alreadyLocked).toBe(true);
    expect((await voteRef().get()).data()).toEqual(initial);
    expect((await db.doc('assemblies/a/public/lastResult').get()).data()).toEqual(publicInitial);
  });
  it('interruption after staging writes commits nothing and a fresh publication succeeds', async () => {
    await submit();
    // Inject a process failure inside the actual emulator transaction, after all writes are staged.
    const interrupted = Object.create(db) as Firestore;
    interrupted.runTransaction = ((fn: Parameters<Firestore['runTransaction']>[0]) => db.runTransaction(async tx => {
      await fn(tx);
      throw new Error('interrupted before commit');
    })) as Firestore['runTransaction'];
    await expect(publishVote(interrupted, 'admin', 'a', 'v')).rejects.toThrow('interrupted');
    expect((await voteRef().get()).data()?.state).toBe('open');
    expect((await db.doc('assemblies/a/public/lastResult').get()).exists).toBe(false);
    await publish();
    expect((await voteRef().get()).data()?.state).toBe('locked');
  });
  it('refuses to sanitize invalid historical ballots', async () => {
    await ballotRef().set({ ranking: ['X', 'A', 'A'] });
    await expect(publish()).rejects.toMatchObject({ status: 409 });
    expect((await voteRef().get()).data()?.state).toBe('open');
  });
  it('does not recalculate or repair already published historical results', async () => {
    const results = { winnerId: 'historical', total: 42 };
    await voteRef().update({ state: 'locked', results });
    expect(await publish()).toMatchObject({ alreadyLocked: true, results });
    expect((await voteRef().get()).data()?.results).toEqual(results);
  });
  it('closes an expired empty vote without a winner and permits the next vote', async () => {
    await voteRef().update({ rulesVersion: 1, eligibleCountAtOpen: 3, deadlineEnforced: true, closesAt: Timestamp.fromMillis(1) });
    expect(await publish()).toMatchObject({ results: { outcome: 'no-ballots', total: 0, winnerId: null, fullRanking: [] } });
    await voteRef('next').set({ state: 'draft', projectIds: ['A', 'B'] });
    expect(await openVote(db, 'admin', 'a', 'next')).toMatchObject({ alreadyOpen: false });
  });
  it.each([[119, 60, 'quorum-not-met'], [120, 60, 'adopted'], [0, 0, 'no-ballots']] as const)(
    'publishes versioned decision for %i / 200 at %i percent', async (total, pct, expected) => {
      await voteRef().update({ rulesVersion: 1, eligibleCountAtOpen: 200, quorumPct: pct });
      const batch = db.batch();
      for (let i = 0; i < total; i++) batch.set(ballotRef(`voter-${i}`), { ranking: ['A'] });
      await batch.commit();
      const result = await publish();
      expect(result.results).toMatchObject({ decisionStatus: expected, adopted: expected === 'adopted',
        winnerId: expected === 'adopted' ? 'A' : null, total, eligibleCount: 200, quorumPct: pct });
      const publicResult = (await db.doc('assemblies/a/public/lastResult').get()).data();
      expect(publicResult).toMatchObject({ decisionStatus: expected, winnerId: expected === 'adopted' ? 'A' : null });
      expect((await voteRef().get()).data()?.state).toBe('locked');
    });
  it('publishes tied candidates with no unique official winner under new rules', async () => {
    await voteRef().update({ rulesVersion: 1, eligibleCountAtOpen: 2, quorumPct: 100 });
    await ballotRef('m').set({ ranking: ['A', 'B', 'C'] });
    await ballotRef('n').set({ ranking: ['B', 'A', 'C'] });
    const result = await publish();
    expect(result.results).toMatchObject({ decisionStatus: 'tie', adopted: false, winnerId: null, tiedWinnerIds: ['A', 'B'] });
    expect(result.results.fullRanking.map((r: { rank: number }) => r.rank)).toEqual([1, 1, 3]);
    expect((await db.doc('assemblies/a/public/lastResult').get()).data()?.winnerLabel).toBe('Égalité — aucun vainqueur unique');
  });
  it('preserves already open legacy rules: late membership, ID tie-break, no quorum veto, no empty publication', async () => {
    await expect(publish()).rejects.toMatchObject({ status: 409 });
    await voteRef().update({ eligibleCountAtOpen: 200, quorumPct: 100 });
    await submit('m', ['A', 'B']); await submit('n', ['B', 'A']);
    const result = await publish();
    expect(result.results.winnerId).toBe('A');
    expect(result.results.rulesVersion).toBeUndefined();
  });
  it('refuses opening when no active electorate exists, including an inactive administrator', async () => {
    await Promise.all(['admin', 'm', 'n'].map(u => member(u, 'blocked', u === 'admin' ? 'admin' : 'member')));
    await voteRef().update({ state: 'draft', rulesVersion: 1, eligibilityPolicy: 'snapshot-active-v1' });
    await expect(openVote(db, 'admin', 'a', 'v')).rejects.toMatchObject({ status: 403 });
    expect((await voteRef().get()).data()?.state).toBe('draft');
  });
  it('opening repairs stale assembly pointers without modifying old results', async () => {
    await voteRef().update({ state: 'locked', results: { total: 9, winnerId: 'A' } });
    await voteRef('next').set({ state: 'draft', projectIds: ['A', 'B'] });
    await openVote(db, 'admin', 'a', 'next');
    expect((await db.doc('assemblies/a').get()).data()?.activeVoteId).toBe('next');
    expect((await voteRef().get()).data()?.results).toEqual({ total: 9, winnerId: 'A' });
  });
  it('restricts lifecycle operations to active administrators', async () => {
    await expect(openVote(db, 'm', 'a', 'v')).rejects.toMatchObject({ status: 403 });
    await expect(publishVote(db, 'm', 'a', 'v')).rejects.toMatchObject({ status: 403 });
    await member('admin', 'blocked', 'admin');
    await expect(publish()).rejects.toMatchObject({ status: 403 });
  });
  it('allows only one concurrent opening and retains a stable eligibility count on repeat', async () => {
    await db.doc('assemblies/a').update({ state: 'draft', activeVoteId: null });
    await voteRef().update({ state: 'draft' });
    await voteRef('w').set({ state: 'draft', projectIds: ['A', 'B'] });
    const results = await Promise.allSettled(['v', 'w'].map(v => openVote(db, 'admin', 'a', v)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const active = (await db.doc('assemblies/a').get()).data()?.activeVoteId;
    const first = (await voteRef(active).get()).data();
    await member('new');
    expect(await openVote(db, 'admin', 'a', active)).toMatchObject({ alreadyOpen: true });
    expect((await voteRef(active).get()).data()).toEqual(first);
  });
  it('publishing an older open vote preserves another active vote, including concurrent publications', async () => {
    await voteRef('w').set({ state: 'open', projectIds: ['A', 'B'] });
    await db.doc('assemblies/a').update({ activeVoteId: 'w' });
    await submit(); await submit('n', ['B'], 'w');
    await publish();
    expect((await db.doc('assemblies/a').get()).data()).toMatchObject({ state: 'open', activeVoteId: 'w' });
    await Promise.all([publish(), publish('w')]);
    expect((await db.doc('assemblies/a').get()).data()).toMatchObject({ state: 'locked', activeVoteId: null });
    expect((await db.doc('assemblies/a/public/lastResult').get()).data()?.voteId).toBe('w');
  });
  it('opening a new vote concurrently with publication never clears the new active vote', async () => {
    await submit();
    await voteRef('next').set({ state: 'draft', projectIds: ['A', 'B'] });
    const outcomes = await Promise.allSettled([publish(), openVote(db, 'admin', 'a', 'next')]);
    expect(outcomes[0].status).toBe('fulfilled');
    if (outcomes[1].status === 'rejected') await openVote(db, 'admin', 'a', 'next');
    expect((await db.doc('assemblies/a').get()).data()).toMatchObject({ state: 'open', activeVoteId: 'next' });
    expect((await voteRef('next').get()).data()?.state).toBe('open');
  });
});

describe('Firestore authorization cannot bypass the server', () => {
  const client = (uid: string) => env.authenticatedContext(uid).firestore();
  it('allows draft preparation but denies forged states, server counters and results, even to admin', async () => {
    const admin = client('admin');
    await assertSucceeds(setDoc(doc(admin, 'assemblies/a/votes/draft'), { state: 'draft', eligibilityPolicy: 'snapshot-active-v1', rulesVersion: 1, projectIds: ['A', 'B'], question: 'Prepare' }));
    await assertSucceeds(updateDoc(doc(admin, 'assemblies/a/votes/draft'), { question: 'Revised' }));
    await assertFails(setDoc(doc(admin, 'assemblies/a/votes/legacy-forged'), { state: 'draft' }));
    await assertFails(updateDoc(doc(admin, 'assemblies/a/votes/draft'), { eligibilityPolicy: null }));
    for (const data of [{ state: 'open' }, { state: 'locked' }, { state: 'draft', results: {} }, { state: 'draft', ballotCount: 100 }, { state: 'draft', eligibleCountAtOpen: 10 }]) {
      await assertFails(setDoc(doc(admin, 'assemblies/a/votes/forged'), data));
      await assertFails(updateDoc(doc(admin, 'assemblies/a/votes/draft'), data));
    }
  });
  it('denies direct writes and listing for anonymous, member and admin; permits only own read', async () => {
    await submit();
    for (const c of [env.unauthenticatedContext().firestore(), client('m'), client('admin')]) {
      for (const uid of ['m', 'admin']) {
        const ref = doc(c, `assemblies/a/votes/v/ballots/${uid}`);
        await assertFails(setDoc(ref, { ranking: ['A'] }));
        await assertFails(updateDoc(ref, { ranking: ['B'] }));
        await assertFails(deleteDoc(ref));
      }
      await assertFails(getDocs(collection(c, 'assemblies/a/votes/v/ballots')));
    }
    await assertSucceeds(getDoc(doc(client('m'), 'assemblies/a/votes/v/ballots/m')));
    await assertFails(getDoc(doc(client('admin'), 'assemblies/a/votes/v/ballots/m')));
    await member('m', 'blocked');
    await db.doc('assemblies/a/members/m').set({ status: 'active', role: 'admin' });
    await assertFails(getDoc(doc(client('m'), 'assemblies/a/votes/v/ballots/m')));
  });
  it('freezes open parameters and locked results, public copies and assembly lifecycle', async () => {
    const admin = client('admin');
    for (const patch of [{ state: 'draft' }, { projectIds: ['X'] }, { question: 'Changed' }, { closesAt: null }, { quorumPct: 0 }, { results: {} }, { ballotCount: 99 }]) {
      await assertFails(updateDoc(doc(admin, 'assemblies/a/votes/v'), patch));
    }
    await submit(); await publish();
    await assertFails(updateDoc(doc(admin, 'assemblies/a/votes/v'), { results: {} }));
    await assertFails(deleteDoc(doc(admin, 'assemblies/a/votes/v')));
    for (const ref of [doc(admin, 'assemblies/a/public/lastResult'), doc(admin, 'assemblies/a')]) {
      await assertFails(setDoc(ref, { state: 'open', activeVoteId: 'forged' }));
      await assertFails(deleteDoc(ref));
    }
    await assertFails(updateDoc(doc(admin, 'assemblies/a/public/lastResult'), { winnerId: 'X' }));
  });
  it('denies electorate snapshot reads and mutations even to an administrator', async () => {
    await voteRef().collection('electorate').doc('snapshot').set({ uids: ['m'] });
    for (const c of [client('m'), client('admin')]) {
      const ref = doc(c, 'assemblies/a/votes/v/electorate/snapshot');
      await assertFails(getDoc(ref));
      await assertFails(setDoc(ref, { uids: ['m', 'n'] }));
      await assertFails(deleteDoc(ref));
    }
  });
});

describe('proposal snapshots at opening on real Firestore', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6xC0AAAAASUVORK5CYII=', 'base64');
  async function draft() {
    await voteRef().update({ state: 'draft', rulesVersion: 1, eligibilityPolicy: 'snapshot-active-v1', quorumPct: 0 });
    await db.doc('assemblies/a').update({ state: 'draft', activeVoteId: null });
  }
  it('rejects an archive that fits alone but would exceed the document limit at publication', async () => {
    await draft();
    await db.doc('projects/A').update({ title: 'x'.repeat(600000) });
    await expect(openVote(db, 'admin', 'a', 'v')).rejects.toMatchObject({ status: 409 });
    const data = (await voteRef().get()).data()!;
    expect(data.state).toBe('draft');
    expect(data.proposalSnapshots).toBeUndefined();
    expect((await db.doc('assemblies/a').get()).data()!.activeVoteId).toBeNull();
  });
  it('keeps texts, image and attachment bytes after source replacement/deletion, through publication and PV', async () => {
    await draft();
    await db.doc('projects/A').update({ longDescription: 'Original description', ownerName: 'Original author', ownerBio: 'Original bio',
      imageUrl: 'https://images.unsplash.com/original', links: [{ label: 'Budget original', url: 'https://storage.googleapis.com/budget.pdf' }] });
    const fetchMedia = vi.fn(async (input: string | URL | Request) => new Response(String(input).endsWith('.pdf') ? '%PDF-1.7 original' : png));
    await openVote(db, 'admin', 'a', 'v', fetchMedia);
    const opened = (await voteRef().get()).data()!;
    const frozen = projectsForVote(opened as Vote);
    expect(frozen[0]).toMatchObject({ title: 'Project A', longDescription: 'Original description', ownerName: 'Original author', budget: '100 €' });
    expect(frozen[0].imageUrl).toBe(`data:image/png;base64,${png.toString('base64')}`);
    expect(frozen[0].links![0].url).toBe(`data:application/pdf;base64,${Buffer.from('%PDF-1.7 original').toString('base64')}`);
    expect(opened.proposalContentHash).toBe(contentHash(opened.proposalSnapshots));
    await db.doc('projects/A').set({ title: 'Replaced', summary: 'Changed', budget: '999 €', imageUrl: 'https://images.unsplash.com/replaced' });
    for (const p of ['A', 'B', 'C']) await db.doc(`projects/${p}`).delete();
    fetchMedia.mockImplementation(async () => new Response(null, { status: 404 }));
    expect((await openVote(db, 'admin', 'a', 'v', fetchMedia)).alreadyOpen).toBe(true);
    await submit();
    expect((await publish()).results).toMatchObject({ winnerId: 'A', proposalContentHash: opened.proposalContentHash });
    const data = (await voteRef().get()).data()!;
    expect(projectsForVote(data as Vote)).toEqual(frozen);
    expect(data.results.fullRanking[0].title).toBe('Project A');
    expect((await db.doc('assemblies/a/public/lastResult').get()).data()?.winnerLabel).toBe('Project A');
    expect(fetchMedia).toHaveBeenCalledTimes(2);
    const result = data.results;
    const seal = computeFinalSeal({ voteId: 'v', method: 'schulze', lockedAtISO: data.lockedAt.toDate().toISOString(),
      ballotsCount: 1, participationPct: 33, winnerId: 'A', proposalContentHash: opened.proposalContentHash,
      ranking: result.fullRanking.map((r: { id: string; title: string; score: number }) => ({ projectId: r.id, title: r.title, score: r.score })), decision: decisionForSeal(result) });
    const verify = await verifyGET(new Request(`http://localhost/verify?assemblyId=a&voteId=v&seal=${seal}`));
    expect(await verify.json()).toMatchObject({ ok: true, match: true });
    expect((await pdfGET(new Request('http://localhost/pdf'), { params: Promise.resolve({ assemblyId: 'a', voteId: 'v' }) })).status).toBe(200);
  });
  it.each(['edit', 'delete', 'draft-edit', 'suspend-admin'])('aborts atomic opening when %s occurs during media preparation', async action => {
    await draft();
    await db.doc('projects/A').update({ imageUrl: 'https://images.unsplash.com/original' });
    const fetchMedia = vi.fn(async () => {
      if (action === 'delete') await db.doc('projects/A').delete();
      if (action === 'edit') await db.doc('projects/A').update({ title: 'Concurrent edit' });
      if (action === 'draft-edit') await voteRef().update({ question: 'Concurrent question' });
      if (action === 'suspend-admin') await member('admin', 'blocked', 'admin');
      return new Response(png);
    });
    await expect(openVote(db, 'admin', 'a', 'v', fetchMedia)).rejects.toMatchObject({ status: action === 'suspend-admin' ? 403 : 409 });
    expect((await voteRef().get()).data()).toMatchObject({ state: 'draft' });
    expect((await voteRef().get()).data()).not.toHaveProperty('proposalSnapshots');
    expect((await voteRef().collection('electorate').doc('snapshot').get()).exists).toBe(false);
    expect((await db.doc('assemblies/a').get()).data()?.activeVoteId).toBeNull();
  });
  it('refuses absent sources or unavailable media without opening, then allows retry', async () => {
    await draft();
    await db.doc('projects/C').delete();
    await expect(openVote(db, 'admin', 'a', 'v')).rejects.toMatchObject({ status: 409 });
    await db.doc('projects/C').set({ title: 'C', summary: 'S', budget: '100', imageUrl: 'https://images.unsplash.com/original' });
    await expect(openVote(db, 'admin', 'a', 'v', async () => new Response(null, { status: 404 }))).rejects.toMatchObject({ status: 409 });
    expect((await voteRef().get()).data()?.state).toBe('draft');
    await openVote(db, 'admin', 'a', 'v', async () => new Response(png));
    expect((await voteRef().get()).data()?.state).toBe('open');
  });
  it('denies forged/deleted snapshot fields and fails closed on corrupted versioned content', async () => {
    await draft();
    const client = env.authenticatedContext('admin').firestore();
    await assertFails(updateDoc(doc(client, 'assemblies/a/votes/v'), { proposalSnapshotVersion: 1, proposalSnapshots: [] }));
    await openVote(db, 'admin', 'a', 'v');
    await assertSucceeds(getDoc(doc(env.authenticatedContext('m').firestore(), 'assemblies/a/votes/v')));
    for (const patch of [{ proposalSnapshotVersion: null }, { proposalSnapshots: [] }, { proposalContentHash: 'forged' }]) {
      await assertFails(updateDoc(doc(client, 'assemblies/a/votes/v'), patch));
    }
    await voteRef().update({ proposalSnapshots: [] }); // Simulated privileged data corruption, never a client write.
    await expect(submit()).rejects.toMatchObject({ status: 409 });
    await expect(publish()).rejects.toMatchObject({ status: 409 });
  });
  it('does not backfill content of historical open/locked votes', async () => {
    await openVote(db, 'admin', 'a', 'v');
    expect((await voteRef().get()).data()).not.toHaveProperty('proposalSnapshots');
    await submit(); await publish();
    const old = (await voteRef().get()).data();
    await db.doc('projects/A').delete(); await publish();
    expect((await voteRef().get()).data()).toEqual(old);
  });
});

describe('HTTP handlers with real Auth emulator tokens', () => {
  async function token() {
    const res = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
    });
    return await res.json() as { idToken: string; localId: string };
  }
  const context = { params: Promise.resolve({ assemblyId: 'a', voteId: 'v' }) };
  const request = (token?: string, body = '{"ranking":["A"]}') => new Request('http://localhost/ballots', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body,
  });
  it('returns 401 for missing or invalid credentials on every mutation endpoint', async () => {
    for (const handler of [ballotPOST, openPOST, publishPOST]) {
      expect((await handler(request(), context)).status).toBe(401);
      expect((await handler(request('invalid'), context)).status).toBe(401);
    }
  });
  it('authenticates tokens, enforces member/admin roles and returns validation errors', async () => {
    const { idToken, localId } = await token();
    expect((await ballotPOST(request(idToken), context)).status).toBe(403);
    await member(localId);
    expect((await ballotPOST(request(idToken, '{'), context)).status).toBe(400);
    expect((await ballotPOST(request(idToken, '{"ranking":["X"]}'), context)).status).toBe(400);
    expect((await ballotPOST(request(idToken), context)).status).toBe(200);
    expect((await publishPOST(request(idToken), context)).status).toBe(403);
    await member(localId, 'active', 'admin');
    expect((await publishPOST(request(idToken), context)).status).toBe(200);
    expect((await ballotPOST(request(idToken), context)).status).toBe(409);
  });
});

describe('published decisions and PV', () => {
  it.each(['adopted', 'quorum-not-met', 'no-ballots', 'tie'] as const)('generates and verifies a PDF for %s', async status => {
    await voteRef().update({ rulesVersion: 1, eligibleCountAtOpen: 200, quorumPct: status === 'quorum-not-met' ? 60 : 0 });
    if (status !== 'no-ballots') await ballotRef('m').set({ ranking: ['A', 'B', 'C'] });
    if (status === 'tie') await ballotRef('n').set({ ranking: ['B', 'A', 'C'] });
    await publish();
    const data = (await voteRef().get()).data()!;
    const result = data.results;
    expect(result.decisionStatus).toBe(status);
    const pdf = await pdfGET(new Request('http://localhost/pdf'), { params: Promise.resolve({ assemblyId: 'a', voteId: 'v' }) });
    expect(pdf.status).toBe(200);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
    const seal = computeFinalSeal({ voteId: 'v', method: 'schulze', lockedAtISO: data.lockedAt.toDate().toISOString(),
      ballotsCount: result.total, participationPct: Math.round(100 * result.total / 200), winnerId: result.winnerId,
      ranking: result.fullRanking.map((r: { id: string; score: number }) => ({ projectId: r.id, title: r.id, score: r.score })),
      decision: decisionForSeal(result) });
    const response = await verifyGET(new Request(`http://localhost/verify?assemblyId=a&voteId=v&seal=${seal}`));
    expect(await response.json()).toMatchObject({ ok: true, match: true });
  });
  it('does not seal results injected into an unclosed vote', async () => {
    await voteRef().update({ results: { winnerId: 'A', fullRanking: [{ id: 'A', rank: 1 }], total: 1 } });
    const context = { params: Promise.resolve({ assemblyId: 'a', voteId: 'v' }) };
    expect((await pdfGET(new Request('http://localhost/pdf'), context)).status).toBe(409);
    expect((await verifyGET(new Request('http://localhost/verify?assemblyId=a&voteId=v&seal=x'))).status).toBe(409);
  });
});
