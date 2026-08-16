import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'firebase/auth';
import firebaseConfigManual from '../../firebase-applet-config.json';

// Use environment variables if available (for Vercel), otherwise fallback to the JSON file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigManual.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigManual.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigManual.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigManual.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigManual.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigManual.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (firebaseConfigManual as any).firestoreDatabaseId
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error: any) {
    console.warn("Popup blocked or failed, attempting redirect...", error);
    try {
      await signInWithRedirect(auth, provider);
    } catch (redirectError: any) {
      console.error("Error signing in with Google redirect", redirectError);
      alert("Não foi possível abrir o login do Google no iframe. Por favor, abra o aplicativo em uma nova aba.");
    }
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
  localStorage.removeItem('boggle_guest_user');
  window.location.reload();
};

export interface GuestUser {
  uid: string;
  displayName: string;
  isGuest: boolean;
}

export const getGuestUser = (): GuestUser | null => {
  const stored = localStorage.getItem('boggle_guest_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
};

export const loginAsGuest = (name: string): GuestUser => {
  const trimmed = name.trim() || `Convidado_${Math.floor(Math.random() * 9000 + 1000)}`;
  const guest: GuestUser = {
    uid: 'guest_' + Math.random().toString(36).substring(2, 9),
    displayName: trimmed,
    isGuest: true
  };
  localStorage.setItem('boggle_guest_user', JSON.stringify(guest));
  return guest;
};


