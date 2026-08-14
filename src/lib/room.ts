import { db } from './firebase';
import { collection, doc, setDoc, getDoc, updateDoc, arrayUnion, increment, addDoc } from 'firebase/firestore';
import { generateBoard } from './boggle';

export const createRoom = async (hostId: string, gridSize: number, minWordLength: number, duration: number) => {
  const roomRef = doc(collection(db, 'rooms'));
  const roomId = roomRef.id;
  
  await setDoc(roomRef, {
    hostId,
    status: 'waiting',
    board: generateBoard(gridSize),
    gridSize,
    minWordLength,
    duration,
    endTime: 0
  });
  
  return roomId;
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
export const saveFinalStats = async (roomId: string, userId: string, addedScore: number, addedWords: number, isWinner: boolean) => {
  try {
    const playerRef = doc(db, 'rooms', roomId, 'players', userId);
    const playerSnap = await getDoc(playerRef);
    
    if (playerSnap.exists() && playerSnap.data().statsSaved) {
      return;
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const currentHigh = userSnap.exists() ? (userSnap.data().highestSingleGameScore || 0) : 0;
    const newHigh = Math.max(currentHigh, addedScore);

    const updates: any = {
      totalScore: increment(addedScore),
      wordsFound: increment(addedWords),
      gamesPlayed: increment(1),
      highestSingleGameScore: newHigh,
      lastPlayedAt: new Date().toISOString()
    };
    
    if (isWinner) {
      updates.wins = increment(1);
    }
    
    await updateDoc(userRef, updates);
    await updateDoc(playerRef, { statsSaved: true });
  } catch (e) {
    console.error("Erro ao salvar status final persistente:", e);
  }
};
