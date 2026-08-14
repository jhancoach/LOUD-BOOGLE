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
