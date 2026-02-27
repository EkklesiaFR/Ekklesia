'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Singleton cache for Firebase SDKs
let cachedSdks: {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} | null = null;

/**
 * Initializes Firebase using a strict singleton pattern.
 * Ensures that the same instances are shared across the entire application.
 */
export function initializeFirebase() {
  if (cachedSdks) return cachedSdks;

  let firebaseApp: FirebaseApp;

  if (!getApps().length) {
    try {
      // Attempt to initialize via Firebase App Hosting (production)
      firebaseApp = initializeApp();
      console.log('[FIREBASE] Initialized with App Hosting defaults');
    } catch (e) {
      // Fallback to manual config (development)
      firebaseApp = initializeApp(firebaseConfig);
      console.log('[FIREBASE] Initialized with manual config');
    }
  } else {
    firebaseApp = getApp();
    console.log('[FIREBASE] Using existing App instance:', firebaseApp.name);
  }

  cachedSdks = {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
  };

  return cachedSdks;
}

/**
 * Helper to get initialized SDKs from an existing app.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
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
