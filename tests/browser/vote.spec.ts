import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { publishVote, submitBallot } from '../../src/lib/server/vote-service';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Browser checks require local emulators');
}
const app = initializeApp({ projectId: 'demo-ekklesia-test' }, 'browser');
const db = getFirestore(app);
const assembly = db.doc('assemblies/default-assembly');
const vote = assembly.collection('votes').doc('browser-vote');
const archivedImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6xC0AAAAASUVORK5CYII=';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.waitForFunction(() => Object.keys(document.querySelector('input[type=email]') ?? {}).some(k => k.startsWith('__reactProps')));
  await page.locator('input[type=email]').fill(email);
  await expect(page.locator('input[type=email]')).toHaveValue(email);
  await page.locator('input[type=password]').fill('Local-test-password-123');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/assembly/);
}

test('admin opens, member deposits and revises, admin publishes, member sees the result and PDF', async ({ browser }) => {
  for (const [uid, role] of [['browser-admin', 'admin'], ['browser-member', 'member']]) {
    await getAuth(app).createUser({ uid, email: `${uid}@example.test`, password: 'Local-test-password-123' });
    await db.doc(`members/${uid}`).set({ role, status: 'active', email: `${uid}@example.test`, displayName: uid });
  }
  await assembly.set({ state: 'draft', title: 'Browser assembly', activeVoteId: null });
  await vote.set({ state: 'draft', rulesVersion: 1, eligibilityPolicy: 'snapshot-active-v1', question: 'Choix du projet test', projectIds: ['browser-A', 'browser-B'], quorumPct: 0 });
  for (const id of ['browser-A', 'browser-B']) await db.doc(`projects/${id}`).set({ title: `Projet original ${id}`, summary: 'Résumé original', longDescription: 'Description soumise au scrutin', budget: '100', imageUrl: archivedImage,
    links: [{ label: 'Pièce originale', url: 'data:application/pdf;base64,JVBERi0xLjcKZXhhbXBsZQ==' }], status: 'candidate', createdAt: new Date() });

  const adminContext = await browser.newContext();
  const memberContext = await browser.newContext();
  // Do not let a test browser contact production Firebase, remote fonts or image services.
  for (const context of [adminContext, memberContext]) await context.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
  });
  const admin = await adminContext.newPage();
  const member = await memberContext.newPage();
  await login(admin, 'browser-admin@example.test');
  await admin.goto('/admin');
  await admin.getByRole('button', { name: /Ouvrir/i }).click();
  await expect.poll(async () => (await vote.get()).data()?.state).toBe('open');
  const originalHash = (await vote.get()).data()?.proposalContentHash;
  await db.doc('projects/browser-A').update({ title: 'Projet modifié', longDescription: 'Description modifiée', imageUrl: 'https://images.unsplash.com/replaced' });
  await db.doc('projects/browser-A').delete();
  await db.doc('projects/browser-B').delete();
  await login(member, 'browser-member@example.test');
  await member.goto('/vote');
  await member.getByRole('button', { name: 'Consulter Projet original browser-A', exact: true }).click();
  await expect(member.getByRole('dialog').getByText('Description soumise au scrutin')).toBeVisible();
  await expect(member.getByRole('dialog').getByRole('img', { name: 'Projet original browser-A', exact: true })).toHaveAttribute('src', archivedImage);
  const downloadPromise = member.waitForEvent('download');
  await member.getByRole('dialog').getByRole('link', { name: 'Pièce originale' }).click();
  const downloaded = await downloadPromise;
  expect(downloaded.suggestedFilename()).toBe('piece-1.pdf');
  expect(await readFile((await downloaded.path())!, 'utf8')).toBe('%PDF-1.7\nexample');
  await member.getByRole('button', { name: 'Close', exact: true }).click();
  await member.getByRole('button', { name: 'Valider mon classement' }).click();
  await expect(member.getByText('Votre vote est déjà enregistré.')).toBeVisible();
  const aHandle = member.getByRole('button', { name: 'Déplacer Projet original browser-A', exact: true });
  const bHandle = member.getByRole('button', { name: 'Déplacer Projet original browser-B', exact: true });
  await aHandle.scrollIntoViewIfNeeded(); await bHandle.scrollIntoViewIfNeeded();
  const a = (await aHandle.boundingBox())!; const b = (await bHandle.boundingBox())!;
  await member.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await member.mouse.down();
  await member.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await member.mouse.up();
  await expect(member.getByRole('button', { name: /^Déplacer / }).first()).toHaveAttribute('aria-label', 'Déplacer Projet original browser-B');
  // A different voter changes participation while this member has an unsaved revision.
  await submitBallot(db, 'browser-admin', 'default-assembly', 'browser-vote', ['browser-B', 'browser-A']);
  await expect(member.getByText('2 / 2 membres')).toBeVisible();
  await expect(member.getByRole('button', { name: /^Déplacer / }).first()).toHaveAttribute('aria-label', 'Déplacer Projet original browser-B');
  await member.getByRole('button', { name: 'Mettre à jour mon vote' }).click();
  await expect.poll(async () => (await vote.collection('ballots').doc('browser-member').get()).data()?.ranking).toEqual(['browser-B', 'browser-A']);
  await expect.poll(async () => (await vote.get()).data()?.ballotCount).toBe(2);
  await expect(admin.getByText('2 / 2').first()).toBeVisible();
  await admin.getByRole('button', { name: /Publier/i }).click();
  await expect.poll(async () => (await vote.get()).data()?.state).toBe('locked');
  await member.goto('/results/browser-vote');
  await expect(member.getByText('Choix du projet test').first()).toBeVisible();
  await member.getByRole('button', { name: 'Consulter Projet original browser-A', exact: true }).click();
  await expect(member.getByRole('dialog').getByText('Description soumise au scrutin')).toBeVisible();
  await expect(member.getByRole('dialog').getByRole('img', { name: 'Projet original browser-A', exact: true })).toHaveAttribute('src', archivedImage);
  await member.getByRole('button', { name: 'Close', exact: true }).click();
  expect((await vote.get()).data()?.results.proposalContentHash).toBe(originalHash);
  await expect(admin.getByText('Projet original browser-B', { exact: true }).first()).toBeVisible();
  expect((await vote.get()).data()?.results.total).toBe(2);
  const pdf = await member.request.get('/api/pv/default-assembly/browser-vote/pdf');
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  for (const [name, label, count, quorum] of [
    ['empty', 'Aucun bulletin — aucune décision adoptée', 0, 0],
    ['quorum', 'Quorum non atteint — aucune décision adoptée', 1, 100],
    ['tie', 'Égalité — aucun vainqueur unique', 2, 0],
  ] as const) {
    const ref = assembly.collection('votes').doc(name);
    await assembly.update({ state: 'open', activeVoteId: name });
    await ref.set({ state: 'open', rulesVersion: 1, eligibleCountAtOpen: 2, quorumPct: quorum,
      question: `Constat ${name}`, projectIds: ['browser-A', 'browser-B'] });
    if (count > 0) await ref.collection('ballots').doc('browser-member').set({ ranking: ['browser-A', 'browser-B'] });
    if (count > 1) await ref.collection('ballots').doc('browser-admin').set({ ranking: ['browser-B', 'browser-A'] });
    await publishVote(db, 'browser-admin', 'default-assembly', name);
    await member.goto(`/results/${name}`);
    await expect(member.getByText(label, { exact: true }).first()).toBeVisible();
    await expect(member.getByRole('button', { name: /PDF/i })).toBeEnabled();
    if (name === 'tie') {
      expect((await ref.get()).data()?.results.fullRanking.map((r: { rank: number }) => r.rank)).toEqual([1, 1]);
    }
  }
  await adminContext.close(); await memberContext.close();
});
