import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Tests require Firestore AND Auth emulators; production access prohibited');
}
let env: RulesTestEnvironment;
const collections = ['memberships', 'payments', 'paymentEvents', 'financialLedger', 'fundPeriods'];
beforeAll(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-ekklesia-test', firestore: {
    host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8'),
  } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'members', 'member'), { role: 'member', status: 'active' });
    await setDoc(doc(db, 'members', 'admin'), { role: 'admin', status: 'active' });
    await setDoc(doc(db, 'members', 'pending'), { role: 'member', status: 'pending' });
    for (const name of collections) await setDoc(doc(db, name, 'member'), { uid: 'member', schemaVersion: 1 });
    await setDoc(doc(db, 'memberships', 'admin'), { uid: 'admin', schemaVersion: 1 });
    await setDoc(doc(db, 'memberships', 'pending'), { uid: 'pending', schemaVersion: 1 });
    // Deliberately misleading uid: only the document path grants the self-read.
    await setDoc(doc(db, 'memberships', 'other'), { uid: 'member', schemaVersion: 1 });
  });
});
afterAll(async () => { await env.cleanup(); });

describe('financial collections remain server-write-only', () => {
  it.each(['anonymous', 'pending', 'member', 'admin'])('denies all financial client mutations for %s', async uid => {
    const db = (uid === 'anonymous' ? env.unauthenticatedContext() : env.authenticatedContext(uid)).firestore();
    for (const name of collections) {
      await assertFails(setDoc(doc(db, name, 'forged'), { uid, status: 'confirmed', amountMinor: 100 }));
      await assertFails(updateDoc(doc(db, name, 'member'), { status: 'active', amountMinor: 999 }));
      await assertFails(deleteDoc(doc(db, name, 'member')));
    }
    // Creating one's own membership is forbidden too.
    await assertFails(setDoc(doc(db, 'memberships', uid), { uid, status: 'active' }));
  });

  it.each(['member', 'pending', 'admin'])('lets %s get only their own membership, without listing', async uid => {
    const db = env.authenticatedContext(uid).firestore();
    await assertSucceeds(getDoc(doc(db, 'memberships', uid)));
    await assertFails(getDoc(doc(db, 'memberships', 'other')));
    if (uid !== 'member') await assertFails(getDoc(doc(db, 'memberships', 'member')));
    await assertFails(getDocs(collection(db, 'memberships')));
  });

  it.each(['anonymous', 'member', 'admin'])('denies private financial reads and queries for %s', async uid => {
    const db = (uid === 'anonymous' ? env.unauthenticatedContext() : env.authenticatedContext(uid)).firestore();
    for (const name of collections.filter(name => uid === 'anonymous' || name !== 'memberships')) {
      await assertFails(getDoc(doc(db, name, 'member')));
      await assertFails(getDocs(collection(db, name)));
    }
  });
});
