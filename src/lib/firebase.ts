import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = (firebaseConfig as any).firestoreDatabaseId 
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
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


