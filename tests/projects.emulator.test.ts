import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'demo-ekklesia-test';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Tests require Firestore AND Auth emulators; production access prohibited');
}
const app = initializeApp({ projectId }, 'project-tests');
const db = getFirestore(app);
vi.mock('../src/lib/firebase/admin', () => ({ getAdminApp: () => app }));
const { GET: homeGET } = await import('../src/app/api/public/home/route');
let env: RulesTestEnvironment;

beforeAll(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  env = await initializeTestEnvironment({ projectId, firestore: {
    host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8'),
  } });
});
beforeEach(async () => { await env.clearFirestore(); });
afterAll(async () => { await env.cleanup(); await deleteApp(app); });

describe('projects are administered only by active root admins', () => {
  it.each([
    ['anonymous', null, null],
    ['pending', 'pending', 'member'],
    ['member', 'active', 'member'],
    ['blocked', 'blocked', 'member'],
    ['revoked', 'revoked', 'member'],
    ['disabled', 'disabled', 'member'],
    ['pending-admin', 'pending', 'admin'],
    ['blocked-admin', 'blocked', 'admin'],
    ['mirror-admin', 'active', 'member'],
  ])('denies create, update and delete to %s, even for an old submitted owner', async (uid, status, role) => {
    if (status) await db.doc(`members/${uid}`).set({ status, role });
    // A mirror must not grant privileges over the root member profile.
    if (uid === 'mirror-admin') await db.doc(`assemblies/a/members/${uid}`).set({ status: 'active', role: 'admin' });
    await db.doc('projects/owned').set({ status: 'submitted', ownerUid: uid, title: 'Original' });
    const client = (status ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
    await assertFails(setDoc(doc(client, 'projects/new'), { status: 'submitted', ownerUid: uid }));
    await assertFails(setDoc(doc(client, 'projects/forged'), { status: 'candidate', ownerUid: uid }));
    await assertFails(updateDoc(doc(client, 'projects/owned'), { title: 'Changed', status: 'candidate' }));
    await assertFails(deleteDoc(doc(client, 'projects/owned')));
    expect((await db.doc('projects/owned').get()).data()?.title).toBe('Original');
  });

  it('preserves active member reads and permits active admin create, update and delete', async () => {
    await db.doc('members/admin').set({ status: 'active', role: 'admin' });
    await db.doc('members/member').set({ status: 'active', role: 'member' });
    const admin = env.authenticatedContext('admin').firestore();
    const ref = doc(admin, 'projects/project');
    await assertSucceeds(setDoc(ref, { title: 'Prepared', status: 'draft', ownerUid: 'member' }));
    await assertSucceeds(getDoc(doc(env.authenticatedContext('member').firestore(), 'projects/project')));
    await assertSucceeds(updateDoc(ref, { status: 'candidate', title: 'Ready' }));
    expect((await db.doc('projects/project').get()).data()?.status).toBe('candidate');
    await assertSucceeds(deleteDoc(ref));
    expect((await db.doc('projects/project').get()).exists).toBe(false);
  });
});

describe('public home HTTP response', () => {
  async function seedPrivateProjects() {
    // These are newer and sort before the candidates by ID: filtering after limit(5) fails.
    for (const [index, status] of ['draft', 'submitted', 'approved', 'rejected', 'elected', null, 'CANDIDATE'].entries()) {
      await db.doc(`projects/a-private-${index}`).set({
        ...(status === null ? {} : { status }), title: `Private ${index}`, createdAt: Timestamp.fromMillis(2000),
      });
    }
  }

  it('returns only candidates, limits to five and does not expose private project fields', async () => {
    await seedPrivateProjects();
    for (let i = 0; i < 7; i++) {
      await db.doc(`projects/z-candidate-${i}`).set({
        status: 'candidate', title: `Candidate ${i}`, summary: 'Public summary', budget: '100 €', imageUrl: '',
        ownerUid: 'private-uid', ownerEmail: 'private@example.test', createdAt: Timestamp.fromMillis(1000),
      });
    }
    await db.doc('members/active').set({ status: 'active' });
    await db.doc('members/pending').set({ status: 'pending' });
    const response = await homeGET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.membersCount).toBe(1);
    expect(body.featuredProjects).toHaveLength(5);
    expect(body.featuredProjects).toEqual(Array.from({ length: 5 }, (_, i) => ({
      id: `z-candidate-${i}`, title: `Candidate ${i}`, summary: 'Public summary', budget: '100 €', imageUrl: '',
    })));
  });

  it('returns no projects when no document is explicitly candidate', async () => {
    await seedPrivateProjects();
    const response = await homeGET();
    expect(response.status).toBe(200);
    expect((await response.json()).featuredProjects).toEqual([]);
  });

  it('stops publishing a project as soon as its status is no longer candidate', async () => {
    const ref = db.doc('projects/project');
    await ref.set({ status: 'candidate', title: 'Candidate' });
    expect((await (await homeGET()).json()).featuredProjects).toHaveLength(1);
    await ref.update({ status: 'rejected' });
    expect((await (await homeGET()).json()).featuredProjects).toEqual([]);
  });
});
