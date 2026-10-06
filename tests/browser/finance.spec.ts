import { test, expect } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
  || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Local emulators required');
const app = initializeApp({ projectId: 'demo-ekklesia-test' }, 'finance-browser');
test.afterAll(async () => { await deleteApp(app); });
test.afterEach(async () => {
  await getFirestore(app).doc('members/finance-browser-member').delete();
  try {
    await getAuth(app).deleteUser('finance-browser-member');
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }
});
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
});

test('public empty fund, read-only API and clickable community card', async ({ page }) => {
  const response = await page.request.get('/api/public/finance');
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'empty', availableMinor: 0, entries: [] });
  expect((await page.request.post('/api/public/finance', { data: {} })).status()).toBe(405);
  await page.goto('/cagnotte');
  await expect(page.getByRole('heading', { name: 'Cagnotte commune' })).toBeVisible();
  await expect(page.getByText('Aucun mouvement financier enregistré pour le moment.')).toBeVisible();
  await expect(page.locator('dd')).toHaveCount(4);
  await expect(page.locator('dt', { hasText: 'Trésorerie actuelle' })).toBeVisible();
  for (const amount of await page.locator('dd').allTextContents()) expect(amount.replace(/\s/g, ' ')).toBe('0,00 €');

  await getAuth(app).createUser({ uid: 'finance-browser-member', email: 'finance-browser@example.test', password: 'Local-test-password-123' });
  await getFirestore(app).doc('members/finance-browser-member').set({ role: 'member', status: 'active' });
  await page.goto('/login');
  await page.waitForFunction(() => Object.keys(document.querySelector('input[type=email]') ?? {}).some(k => k.startsWith('__reactProps')));
  await page.locator('input[type=email]').fill('finance-browser@example.test');
  await page.locator('input[type=password]').fill('Local-test-password-123');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/assembly/);
  const card = page.getByRole('link', { name: /Cagnotte commune.*Voir le registre/ });
  await expect(card).toHaveAttribute('href', '/cagnotte');
  await expect(card).toContainText('Disponible pour les projets');
  await expect(card).toContainText(/0,00/);
  await card.click();
  await expect(page).toHaveURL(/cagnotte/);
  await expect(page.getByRole('heading', { name: 'Registre financier' })).toBeVisible();
});

test('unavailable finances never display a false zero', async ({ page }) => {
  await page.route('**/api/public/finance', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"status":"unavailable"}' }));
  await page.goto('/cagnotte');
  await expect(page.getByRole('status')).toContainText('momentanément indisponibles');
  await expect(page.locator('dd')).toHaveCount(0);
  await expect(page.getByText('Aucun mouvement financier enregistré pour le moment.')).toHaveCount(0);
});
