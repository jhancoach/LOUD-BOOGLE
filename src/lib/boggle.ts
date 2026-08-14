import { checkMasterWordBank } from './wordBank';

export const BOGGLE_DICE_PT = [
  "QBZJXK", "TOUOTO", "OVCGRR", "AAAFSR",
  "AUMEEG", "HLNNRZ", "EOOPTT", "EILRUW",
  "ENSSSU", "AEEMOO", "EHISPN", "AFIRSY",
  "DITEYE", "AJABOO", "AOTTWO", "CIMOTU"
];

export function generateBoard(size: number = 4): string[] {
  const numDice = size * size;
  const dice = [];
  for (let i = 0; i < numDice; i++) {
    dice.push(BOGGLE_DICE_PT[i % BOGGLE_DICE_PT.length]);
  }
  // Shuffle dice
  const shuffled = dice.sort(() => Math.random() - 0.5);
  // Pick random face
  return shuffled.map(die => {
    const letter = die[Math.floor(Math.random() * die.length)];
    return letter === 'Q' ? 'QU' : letter;
  });
}

export function getScore(word: string): number {
  const len = word.length;
  if (len < 3) return 0;
  if (len === 3 || len === 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  if (len === 7) return 5;
  return 11;
}

export function isAdjacent(index1: number, index2: number, size: number = 4): boolean {
  if (index1 === index2) return false;
  const row1 = Math.floor(index1 / size);
  const col1 = index1 % size;
  const row2 = Math.floor(index2 / size);
  const col2 = index2 % size;
  
  return Math.abs(row1 - row2) <= 1 && Math.abs(col1 - col2) <= 1;
}

export async function validateWord(word: string, minLength: number = 3): Promise<boolean> {
  return checkMasterWordBank(word, minLength);
}

/**
 * Finds the sequence of board cell indices that form the given word.
 * Returns null if no valid connected path exists on the board.
 */
export function findWordPath(word: string, board: string[], size: number = 4): number[] | null {
  if (!word || !board || board.length === 0) return null;
  const target = word.toUpperCase();

  function dfs(currentIndex: number, letterPos: number, visited: Set<number>, path: number[]): number[] | null {
    const cellLetter = (board[currentIndex] || '').toUpperCase();
    const matchLen = cellLetter.length;

    // Check if the current cell matches the target substring
    if (target.substring(letterPos, letterPos + matchLen) !== cellLetter) {
      return null;
    }

    const nextPos = letterPos + matchLen;
    const newPath = [...path, currentIndex];

    if (nextPos === target.length) {
      return newPath;
    }

    const newVisited = new Set(visited);
    newVisited.add(currentIndex);

    // Search adjacent cells
    for (let neighbor = 0; neighbor < board.length; neighbor++) {
      if (!newVisited.has(neighbor) && isAdjacent(currentIndex, neighbor, size)) {
        const result = dfs(neighbor, nextPos, newVisited, newPath);
        if (result) return result;
      }
    }

    return null;
  }

  // Start from any matching cell on the board
  for (let startIdx = 0; startIdx < board.length; startIdx++) {
    const result = dfs(startIdx, 0, new Set(), []);
    if (result) return result;
  }

  return null;
}
