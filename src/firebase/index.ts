
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Singleton déterministe pour Firebase.
 * Garantit qu'une seule instance d'App, Auth et Firestore existe.
 */
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Logs de diagnostic pour confirmer le singleton
console.log('[FIREBASE] apps count:', getApps().length);
console.log('[FIREBASE] app name:', app.name);

export { app as firebaseApp, auth, firestore };

/**
 * Retourne les instances initialisées. 
 * Utilisé par le FirebaseProvider pour distribuer les services.
 */
export function initializeFirebase() {
  return {
    firebaseApp: app,
    auth: auth,
    firestore: firestore
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
