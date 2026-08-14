import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { BUILTIN_WORDS_SET } from './wordsData';

export interface CustomWordItem {
  id: string;
  word: string;
  addedBy?: string;
  addedByName?: string;
  createdAt?: any;
}

// In-memory caches
let liveCustomWordsSet = new Set<string>();
let liveCustomWordsList: CustomWordItem[] = [];
let isInitialized = false;

// USP IME Dictionary Set cache
let uspDictionarySet = new Set<string>();
let isUspLoaded = false;
let uspLoadPromise: Promise<void> | null = null;
let uspWordsArray: string[] = [];

// Remove acentos e normaliza
export function normalizeWord(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

// Carrega o dicionário completo do IME-USP (245.000+ palavras)
export async function loadUspDictionary(): Promise<void> {
  if (isUspLoaded) return;
  if (uspLoadPromise) return uspLoadPromise;

  uspLoadPromise = (async () => {
    try {
      const response = await fetch('/words.txt');
      if (!response.ok) {
        throw new Error(`Falha ao carregar dicionário: ${response.statusText}`);
      }
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      const set = new Set<string>();
      const list: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const w = lines[i].trim();
        if (w.length >= 2) {
          set.add(w);
          list.push(w);
        }
      }

      uspDictionarySet = set;
      uspWordsArray = list;
      isUspLoaded = true;
      console.log(`[LOUD BOOGLE] Dicionário IME-USP carregado com sucesso: ${set.size} palavras.`);
    } catch (err) {
      console.error("[LOUD BOOGLE] Erro ao carregar dicionário IME-USP:", err);
    }
  })();

  return uspLoadPromise;
}

// Inicia o carregamento em background assim que o módulo for importado
if (typeof window !== 'undefined') {
  loadUspDictionary();
}

export function getDictionaryWords(): string[] {
  if (isUspLoaded && uspWordsArray.length > 0) {
    return uspWordsArray;
  }
  return Array.from(BUILTIN_WORDS_SET);
}

// Retorna o status e total de palavras do IME-USP
export function getUspDictionaryStats() {
  return {
    isLoaded: isUspLoaded,
    totalWords: isUspLoaded ? uspDictionarySet.size : 245115,
  };
}

// Pesquisa palavras no dicionário IME-USP
export function searchUspWords(term: string, maxResults: number = 100): string[] {
  const clean = normalizeWord(term);
  if (!clean) {
    return (isUspLoaded ? uspWordsArray : Array.from(BUILTIN_WORDS_SET)).slice(0, maxResults);
  }

  if (isUspLoaded) {
    const results: string[] = [];
    for (let i = 0; i < uspWordsArray.length; i++) {
      if (uspWordsArray[i].includes(clean)) {
        results.push(uspWordsArray[i]);
        if (results.length >= maxResults) break;
      }
    }
    return results;
  }

  return Array.from(BUILTIN_WORDS_SET).filter(w => w.includes(clean)).slice(0, maxResults);
}

// Inicializa o listener de palavras customizadas do Firestore
export function subscribeCustomWords(onUpdate?: (words: CustomWordItem[]) => void) {
  if (!db) return () => {};

  const q = query(collection(db, 'word_bank'), orderBy('word', 'asc'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const list: CustomWordItem[] = [];
    const set = new Set<string>();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const w = normalizeWord(data.word || docSnap.id);
      list.push({
        id: docSnap.id,
        word: w,
        addedBy: data.addedBy,
        addedByName: data.addedByName,
        createdAt: data.createdAt
      });
      set.add(w);
    });

    liveCustomWordsList = list;
    liveCustomWordsSet = set;
    isInitialized = true;

    if (onUpdate) {
      onUpdate(list);
    }
  }, (err) => {
    console.error("Erro ao sincronizar banco de palavras customizadas:", err);
  });

  return unsubscribe;
}

// Adiciona uma ou várias palavras customizadas ao Firestore
export async function addCustomWords(
  rawWords: string[] | string,
  userId?: string,
  userName?: string
): Promise<{ added: number; skipped: number; words: string[] }> {
  const wordsArray = Array.isArray(rawWords)
    ? rawWords
    : rawWords.split(/[\n,;]+/).map(w => w.trim());

  let added = 0;
  let skipped = 0;
  const addedWords: string[] = [];

  for (const raw of wordsArray) {
    const clean = normalizeWord(raw);
    if (!clean || clean.length < 2) {
      skipped++;
      continue;
    }

    try {
      const docRef = doc(db, 'word_bank', clean);
      await setDoc(docRef, {
        word: clean,
        addedBy: userId || 'anonymous',
        addedByName: userName || 'Jogador LOUD',
        createdAt: serverTimestamp()
      }, { merge: true });

      liveCustomWordsSet.add(clean);
      addedWords.push(clean);
      added++;
    } catch (e) {
      console.error(`Erro ao adicionar palavra "${clean}":`, e);
      skipped++;
    }
  }

  return { added, skipped, words: addedWords };
}

// Remove uma palavra customizada
export async function removeCustomWord(wordId: string): Promise<boolean> {
  try {
    const cleanId = normalizeWord(wordId);
    await deleteDoc(doc(db, 'word_bank', cleanId));
    liveCustomWordsSet.delete(cleanId);
    return true;
  } catch (e) {
    console.error("Erro ao remover palavra:", e);
    return false;
  }
}

// Validador mestre: checa Dicionário IME-USP (245k+) + Built-in + Custom Firestore + Dicionário Aberto + Regras de Plural
export async function checkMasterWordBank(word: string, minLength: number = 3): Promise<boolean> {
  const clean = normalizeWord(word);
  if (clean.length < minLength) return false;

  // Função auxiliar para checar palavra nos sets existentes
  const existsInLocalBanks = (w: string) => {
    return (isUspLoaded && uspDictionarySet.has(w)) || 
           liveCustomWordsSet.has(w) || 
           BUILTIN_WORDS_SET.has(w);
  };

  // 1. Checa diretamente nos bancos locais
  if (existsInLocalBanks(clean)) return true;

  // 2. Regra de Plural simples para Português (S, ES, IS)
  // Se a palavra termina em S, tentamos encontrar a versão singular
  if (clean.endsWith('S')) {
    const candidates = [];
    // Caso geral: AMIGOS -> AMIGO
    candidates.push(clean.substring(0, clean.length - 1));
    // Caso ES: FLORES -> FLOR, MESES -> MES
    if (clean.endsWith('ES')) {
      candidates.push(clean.substring(0, clean.length - 2));
    }
    // Caso IS: JOGUAIS -> JOGAL (azul -> azuis)
    if (clean.endsWith('IS')) {
       candidates.push(clean.substring(0, clean.length - 2) + 'L');
    }

    for (const cand of candidates) {
      if (cand.length >= 2 && existsInLocalBanks(cand)) return true;
    }
  }

  // Se o dicionário ainda estiver carregando a promise pela primeira vez, aguarda
  if (!isUspLoaded && uspLoadPromise) {
    try {
      await uspLoadPromise;
      if (uspDictionarySet.has(clean)) {
        return true;
      }
    } catch (e) {
      // continua para o fallback
    }
  }

  // 4. Fallback para API do Dicionário Aberto em português
  try {
    const res = await fetch(`https://api.dicionario-aberto.net/word/${clean.toLowerCase()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return true;
      }
    }
  } catch (e) {
    console.warn("Dicionário externo indisponível, checando honestidade.", e);
  }

  return false;
}

