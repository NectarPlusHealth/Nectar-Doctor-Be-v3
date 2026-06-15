// src/config/firebase.ts
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let initialized = false;

/**
 * Initialize Firebase Admin SDK using the service account JSON file.
 * The path is resolved from FIREBASE_SERVICE_ACCOUNT_PATH env variable
 * or defaults to firebase-service-account.json at project root.
 *
 * IMPORTANT: Download the service account JSON from:
 * Firebase Console → Project Settings → Service Accounts → Generate new private key
 * and save it as firebase-service-account.json at the root of this project.
 * Do NOT commit this file to version control.
 */
export function initializeFirebase(): void {
  if (initialized || admin.apps.length > 0) return;

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.resolve(process.cwd(), 'firebase-service-account.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.warn(
      `[Firebase] Service account file not found at: ${serviceAccountPath}. ` +
        'Push notifications will be disabled. ' +
        'Download it from Firebase Console → Project Settings → Service Accounts.'
    );
    return;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log('[Firebase] Admin SDK initialized successfully');
  } catch (err) {
    console.error('[Firebase] Failed to initialize Admin SDK:', err);
  }
}

export function isFirebaseInitialized(): boolean {
  return admin.apps.length > 0;
}

export default admin;
