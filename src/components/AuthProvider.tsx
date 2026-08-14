import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: any;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, profile: null });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: () => void;
    
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, 'users', currentUser.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            const newProfile = {
              name: currentUser.displayName || 'Jogador ' + currentUser.uid.substring(0, 5),
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
            name: currentUser.displayName || 'Jogador ' + currentUser.uid.substring(0, 5),
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
      } else {
        setProfile(null);
        if (unsubProfile) unsubProfile();
      }
      setLoading(false);
    });
    
    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, profile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
