import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      projectId: firebaseConfig.projectId,
    });

export const adminAuth = getAuth(app);

// In firebase-admin, getFirestore accepts (app, databaseId) as arguments in recent versions,
// or settings() must only be called once before any operations.
let dbInstance: any;
try {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
} catch {
  dbInstance = getFirestore(app);
  try {
    if (firebaseConfig.firestoreDatabaseId) {
      dbInstance.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
    }
  } catch {
    // Ignore if already set or not allowed
  }
}

export const adminDb = dbInstance;
