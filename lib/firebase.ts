import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  signInAnonymously,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
export const googleProvider = new GoogleAuthProvider();

export interface CustomUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
  isAnonymous?: boolean;
  isGuest?: boolean;
  getIdToken: () => Promise<string>;
}

export type AuthUser = FirebaseUser | CustomUser;

const LOCAL_GUEST_KEY = "mnemosyne_guest_user";

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    localStorage.removeItem(LOCAL_GUEST_KEY);
    return result.user;
  } catch (error: any) {
    if (error?.code === 'auth/unauthorized-domain') {
      const helpfulError = new Error(
        "auth/unauthorized-domain: 'localhost' is not whitelisted in the Firebase project's Authorized Domains. You can use 'Continue as Guest' for local development or add localhost to your Firebase Console."
      );
      (helpfulError as any).code = 'auth/unauthorized-domain';
      throw helpfulError;
    }
    throw error;
  }
};

export const signInAsGuest = async (guestName: string = "Guest Philosopher"): Promise<AuthUser> => {
  const guestUser: CustomUser = {
    uid: "guest-" + Math.random().toString(36).substring(2, 9),
    displayName: guestName,
    email: "guest@local.dev",
    isAnonymous: true,
    isGuest: true,
    getIdToken: async () => "guest-dev-token"
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_GUEST_KEY, JSON.stringify(guestUser));
  }
  return guestUser;
};

export const getSavedGuestUser = (): CustomUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(LOCAL_GUEST_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return {
      ...parsed,
      getIdToken: async () => "guest-dev-token"
    };
  } catch {
    return null;
  }
};

export const logOut = async () => {
  try {
    localStorage.removeItem(LOCAL_GUEST_KEY);
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

