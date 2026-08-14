export function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}
