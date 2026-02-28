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
  // App Hosting / Cloud Run exposent généralement au moins un de ces envs
  return !!(
    process.env.K_SERVICE ||
    process.env.K_REVISION ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT
  );
}

export function getAdminApp() {
  if (admin.apps.length) return admin.app();

  // ✅ Option A (recommandé) : Service account JSON complet dans 1 variable
  // (utile si tu veux le faire via Secrets/Env en prod, mais pas obligatoire)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: parsed.project_id ?? inferProjectId(),
    });
    return admin.app();
  }

  // ✅ Option B : trio FIREBASE_* (local)
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

  // ✅ Option C : PROD Google (App Hosting / Cloud Run) => ADC (PAS DE CLÉ)
  // Firebase Admin récupère automatiquement les credentials via l’identité du service.
  if (runningOnGoogleInfra()) {
    admin.initializeApp({ projectId });
    return admin.app();
  }

  // ❌ Sinon on fail clairement
  const missing: string[] = [];
  if (!process.env.FIREBASE_PROJECT_ID && !process.env.GOOGLE_CLOUD_PROJECT && !process.env.GCLOUD_PROJECT) {
    missing.push('FIREBASE_PROJECT_ID');
  }
  if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!process.env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');

  throw new Error(
    `Missing Firebase Admin credentials. Provide FIREBASE_SERVICE_ACCOUNT or FIREBASE_* env vars. Missing: ${missing.join(
      ', '
    )}`
  );
}

export function getAdminDb() {
  return getAdminApp().firestore();
}