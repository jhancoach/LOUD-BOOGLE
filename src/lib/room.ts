import { db } from './firebase';
import { collection, doc, setDoc, getDoc, updateDoc, arrayUnion, increment, addDoc } from 'firebase/firestore';
import { generateBoard } from './boggle';

export const createRoom = async (hostId: string, gridSize: number, minWordLength: number, duration: number) => {
  try {
    const roomRef = doc(collection(db, 'rooms'));
    const roomId = roomRef.id;
    
    const setPromise = setDoc(roomRef, {
      hostId,
      status: 'waiting',
      board: generateBoard(gridSize),
      gridSize,
      minWordLength,
      duration,
      endTime: 0
    });

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout ao conectar com o servidor')), 6000)
    );

    await Promise.race([setPromise, timeoutPromise]);
    
    return roomId;
  } catch (error) {
    console.error("Error creating room:", error);
    throw error;
  }
};

export const joinRoom = async (roomId: string, userId: string, userName: string) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists() && roomSnap.data().hostId === 'tv') {
      await updateDoc(roomRef, { hostId: userId });
    }

    const playerRef = doc(db, 'rooms', roomId, 'players', userId);
    const snap = await getDoc(playerRef);
    if (!snap.exists()) {
      await setDoc(playerRef, {
        name: userName,
        words: [],
        statsSaved: false
      });
    }
  } catch (e) {
    console.warn("joinRoom offline or error:", e);
  }
};

export const resetPlayer = async (roomId: string, userId: string, userName: string) => {
  const playerRef = doc(db, 'rooms', roomId, 'players', userId);
  await setDoc(playerRef, {
    name: userName,
    words: [],
    statsSaved: false
  });
};

export const startGame = async (roomId: string, durationSeconds: number) => {
  const roomRef = doc(db, 'rooms', roomId);
  const endTime = Date.now() + durationSeconds * 1000;
  await updateDoc(roomRef, {
    status: 'playing',
    endTime
  });
};

export const restartGame = async (roomId: string, gridSize: number) => {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    status: 'waiting',
    board: generateBoard(gridSize),
    endTime: 0
  });
};

export const addWordToPlayer = async (roomId: string, userId: string, word: string) => {
  const playerRef = doc(db, 'rooms', roomId, 'players', userId);
  await updateDoc(playerRef, {
    words: arrayUnion({ word })
  });
};

export const updateRoomSettings = async (roomId: string, updates: any) => {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, updates);
};

export const transferHost = async (roomId: string, newHostId: string) => {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, { hostId: newHostId });
};

export const suggestWord = async (word: string, userId: string) => {
  await addDoc(collection(db, 'suggestions'), {
    word,
    suggestedBy: userId,
    createdAt: new Date()
  });
};
export const saveFinalStats = async (roomId: string, userId: string, addedScore: number, addedWords: number, rank: number) => {
  try {
    const playerRef = doc(db, 'rooms', roomId, 'players', userId);
    const playerSnap = await getDoc(playerRef);
    
    if (playerSnap.exists() && playerSnap.data().statsSaved) {
      return;
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    let currentHigh = 0;
    let currentName = 'Jogador';
    
    if (userSnap.exists()) {
      const data = userSnap.data();
      currentHigh = data.highestSingleGameScore || 0;
      currentName = data.name || data.displayName || 'Jogador';
    }
    
    const newHigh = Math.max(currentHigh, addedScore);

    const updates: any = {
      totalScore: increment(addedScore),
      wordsFound: increment(addedWords),
      gamesPlayed: increment(1),
      highestSingleGameScore: newHigh,
      lastPlayedAt: new Date().toISOString(),
      name: currentName // Garantir que o nome está lá para o leaderboard
    };

    // Tracking longest word
    if (playerSnap.exists()) {
      const pData = playerSnap.data();
      const pWords = (pData.words || []) as { word: string }[];
      let longestInGame = '';
      pWords.forEach(w => {
        if (w.word.length > longestInGame.length) {
          longestInGame = w.word;
        }
      });

      if (longestInGame) {
        let globalLongest = '';
        if (userSnap.exists()) {
          globalLongest = userSnap.data().longestWordFound || '';
        }

        if (longestInGame.length > globalLongest.length) {
          updates.longestWordFound = longestInGame.toUpperCase();
        }
      }
    }
    
    if (rank === 1) {
      updates.wins = increment(1);
      updates.goldTrophies = increment(1);
    } else if (rank === 2) {
      updates.silverTrophies = increment(1);
    } else if (rank === 3) {
      updates.bronzeTrophies = increment(1);
    }
    
    // Usar setDoc com merge para garantir que o documento exista
    await setDoc(userRef, updates, { merge: true });
    await updateDoc(playerRef, { statsSaved: true });
  } catch (e) {
    console.error("Erro ao salvar status final persistente:", e);
  }
};
