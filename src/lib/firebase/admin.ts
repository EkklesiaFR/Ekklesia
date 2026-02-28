import 'server-only';
import admin from 'firebase-admin';

function stripQuotes(s: string) {
  const v = s.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function normalizePrivateKey(key?: string) {
  if (!key) return undefined;
  let k = stripQuotes(key);
  k = k.replace(/\\n/g, '\n');
  k = k.replace(/\r/g, '').trim();
  return k;
}

function isPem(k?: string) {
  return !!k && k.includes('-----BEGIN PRIVATE KEY-----') && k.includes('-----END PRIVATE KEY-----');
}

function inferProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT
  );
}

function runningOnGoogleInfra() {
  // App Hosting / Cloud Run
  return !!(
    process.env.K_SERVICE ||
    process.env.K_REVISION ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT
  );
}

export function getAdminApp() {
  if (admin.apps.length) return admin.app();

  // Option A: JSON complet (si tu veux le mettre dans un Secret)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: parsed.project_id ?? inferProjectId(),
    });
    return admin.app();
  }

  // Option B: trio local
  const projectId = inferProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (projectId && clientEmail && isPem(privateKey)) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey!,
      }),
      projectId,
    });
    return admin.app();
  }

  // Option C: PROD App Hosting => ADC (pas besoin de private key)
  if (runningOnGoogleInfra()) {
    admin.initializeApp({ projectId });
    return admin.app();
  }

  throw new Error(
    'Firebase Admin init failed: Provide FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY (local).'
  );
}

export function getAdminDb() {
  return getAdminApp().firestore();
}