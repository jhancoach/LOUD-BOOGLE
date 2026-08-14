import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, getGuestUser } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  profile: any;
  loginAsGuest: (name: string) => any;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, profile: null, loginAsGuest: () => {} });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const handleLoginAsGuest = (name: string) => {
    const trimmed = name.trim() || `Convidado_${Math.floor(Math.random() * 9000 + 1000)}`;
    const guest = {
      uid: 'guest_' + Math.random().toString(36).substring(2, 9),
      displayName: trimmed,
      isGuest: true
    };
    localStorage.setItem('boggle_guest_user', JSON.stringify(guest));
    setUser(guest);
    const defaultProfile = {
      name: trimmed,
      wins: 0,
      wordsFound: 0,
      totalScore: 0
    };
    setProfile(defaultProfile);
    setLoading(false);
    return guest;
  };

  useEffect(() => {
    let unsubProfile: () => void;
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setupProfile(currentUser.uid, currentUser.displayName || 'Jogador ' + currentUser.uid.substring(0, 5));
      } else {
        const guest = getGuestUser();
        if (guest) {
          setUser(guest);
          setupProfile(guest.uid, guest.displayName);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    });

    const setupProfile = async (uid: string, defaultName: string) => {
      const docRef = doc(db, 'users', uid);
      try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          const newProfile = {
            name: defaultName,
            wins: 0,
            wordsFound: 0,
            totalScore: 0
          };
          await setDoc(docRef, newProfile, { merge: true });
          setProfile(newProfile);
        } else {
          setProfile(docSnap.data());
        }
      } catch (e) {
        console.warn("Firestore offline/fallback for user profile:", e);
        setProfile({
          name: defaultName,
          wins: 0,
          wordsFound: 0,
          totalScore: 0
        });
      }
      
      try {
        unsubProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          }
        }, (err) => {
          console.warn("User onSnapshot warning:", err);
        });
      } catch (e) {
        console.warn("Error setting onSnapshot for user doc:", e);
      }
      setLoading(false);
    };
    
    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, profile, loginAsGuest: handleLoginAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
