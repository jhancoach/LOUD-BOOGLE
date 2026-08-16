import React, { useState, useEffect, useRef } from 'react';
import { generateBoard, validateWord, isAdjacent } from '../lib/boggle';
import { Play, Check, X, ArrowLeft, RotateCcw, Sparkles, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { suggestWord } from '../lib/room';
import AnimatedTimer from '../components/AnimatedTimer';
import BoardReplay from '../components/BoardReplay';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { fireWinnerConfetti } from '../lib/confetti';
import { 
  playSelectLetter, 
  playWordSuccess, 
  playWordError, 
  playTimerTick, 
  playGameOver, 
  playVictorySound, 
  isAudioMuted, 
  setAudioMuted 
} from '../lib/sounds';

export default function OfflineRoom({ onLeave, duration = 180, gridSize = 4, minWordLength = 3 }: { onLeave: () => void, duration?: number, gridSize?: number, minWordLength?: number }) {
  const { user, profile } = useAuth();
  const [board, setBoard] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [status, setStatus] = useState<'waiting' | 'playing' | 'gameover'>('waiting');
  const [muted, setMuted] = useState(isAudioMuted());
  
  const [currentWord, setCurrentWord] = useState<{index: number, letter: string}[]>([]);
  const [words, setWords] = useState<{word: string, score: number}[]>([]);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error', word?: string} | null>(null);
  const [hasSavedSoloStats, setHasSavedSoloStats] = useState(false);
  
  const boardRef = useRef<HTMLDivElement>(null);

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  useEffect(() => {
    if (status === 'waiting') {
      setBoard(generateBoard(gridSize));
      setTimeLeft(duration);
      setWords([]);
      setCurrentWord([]);
      setMessage(null);
      setHasSavedSoloStats(false);
    }
  }, [status, gridSize, duration]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'playing' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setStatus('gameover');
            return 0;
          }
          if (prev <= 10 && prev > 1) {
            playTimerTick(prev <= 5);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, timeLeft]);

  // Persiste estatísticas de treino para o usuário se estiver logado
  useEffect(() => {
    if (status === 'gameover') {
      if (words.length > 0) {
        playVictorySound();
        fireWinnerConfetti();
      } else {
        playGameOver();
      }
      if (user && !hasSavedSoloStats && words.length > 0) {
        setHasSavedSoloStats(true);
        const totalScore = words.reduce((sum, w) => sum + w.score, 0);
        
        let longestInGame = '';
        words.forEach(w => {
          if (w.word.length > longestInGame.length) {
            longestInGame = w.word;
          }
        });

        const userRef = doc(db, 'users', user.uid);
        const updates: any = {
          totalScore: increment(totalScore),
          wordsFound: increment(words.length),
          gamesPlayed: increment(1)
        };

        if (longestInGame) {
          // We don't have the current longest word here easily without a fetch, 
          // but we can trust the database or just send it and use conditional logic if we were using a function.
          // Since we are using updateDoc, we might overwrite. 
          // However, for simplicity in offline mode, we'll just check if it's longer than what we think it is if we had the profile.
          // Given the structure, let's just use the current longestInGame and we can't easily compare without the profile state.
          // BUT, we can use the 'profile' from useAuth!
        }
        
        if (longestInGame && profile && longestInGame.length > (profile.longestWordFound?.length || 0)) {
          updates.longestWordFound = longestInGame.toUpperCase();
        }

        updateDoc(userRef, updates).catch(err => console.warn("Solo stats persistence warning:", err));
      }
    }
  }, [status, user, hasSavedSoloStats, words]);

  const startGame = () => setStatus('playing');
  const restartGame = () => setStatus('waiting');

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [isFakeFullscreen, setIsFakeFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        setIsFakeFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenEnabled) {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(err => {
          console.error("Error attempting to enable fullscreen:", err);
          setIsFakeFullscreen(true);
        });
      } else {
        await document.exitFullscreen();
        setIsFakeFullscreen(false);
      }
    } else {
      setIsFakeFullscreen(!isFakeFullscreen);
    }
  };

  const handleSuggest = async (word: string) => {
    await suggestWord(word, 'offline-user');
    setMessage({ text: 'Palavra sugerida com sucesso!', type: 'success' });
  };

  const submitOfflineWord = async (wordList: { index: number; letter: string }[]) => {
    if (status !== 'playing' || timeLeft === 0 || wordList.length === 0) return;
    
    const wordStr = wordList.map(w => w.letter).join('');
    setCurrentWord([]);

    if (wordStr.length < minWordLength) {
      playWordError();
      setMessage({ text: `Muito curta! Mínimo de ${minWordLength} letras.`, type: 'error' });
      return;
    }

    if (words.some(w => w.word === wordStr)) {
      playWordError();
      setMessage({ text: 'Palavra já encontrada!', type: 'error' });
      return;
    }

    const canonical = await validateWord(wordStr);
    if (canonical) {
      const score = Math.max(1, wordStr.length - 2);
      playWordSuccess(score);
      setWords(prev => [{word: canonical, score}, ...prev]);
      setMessage({ text: `Palavra válida! +${score} pts`, type: 'success' });
    } else {
      playWordError();
      setMessage({ text: 'Palavra não encontrada.', type: 'error', word: wordStr });
    }
  };

  const gridRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastTouchTimeRef = useRef(0);
  const tileRectsRef = useRef<{index: number, rect: DOMRect, centerX: number, centerY: number}[]>([]);

  const getTileIndexFromCoords = (clientX: number, clientY: number): number | null => {
    if (tileRectsRef.current.length === 0) return null;

    let closestIndex: number | null = null;
    let minDistance = Infinity;
    
    // Determine the size of a single tile from the first element
    const tileWidth = tileRectsRef.current[0].rect.width;
    const maxDistance = tileWidth * 1.5; // Generous outer boundary to catch fast diagonal swipes

    for (const {index, centerX, centerY} of tileRectsRef.current) {
        const dist = Math.hypot(clientX - centerX, clientY - centerY);
        if (dist < minDistance) {
            minDistance = dist;
            closestIndex = index;
        }
    }

    if (closestIndex !== null && minDistance < maxDistance) {
        return closestIndex;
    }

    return null;
  };

  const startDrag = (index: number, letter: string, e?: React.SyntheticEvent) => {
    if (status !== 'playing' || timeLeft === 0) return;

    if (gridRef.current) {
      const tiles = gridRef.current.querySelectorAll('[data-index]');
      tileRectsRef.current = Array.from(tiles).map(t => {
        const rect = t.getBoundingClientRect();
        return {
          index: parseInt(t.getAttribute('data-index')!, 10),
          rect,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2
        };
      });
    }

    const now = Date.now();
    if (e?.type === 'touchstart') {
      lastTouchTimeRef.current = now;
      if (e.cancelable) e.preventDefault();
    } else if (e?.type === 'pointerdown' || e?.type === 'mousedown') {
      if (now - lastTouchTimeRef.current < 400) return;
    }

    isDraggingRef.current = true;
    setMessage(null);

    setCurrentWord(prev => {
      // If clicking last letter again
      if (prev.length > 0 && prev[prev.length - 1].index === index) {
        if (prev.length >= minWordLength) {
          setTimeout(() => submitOfflineWord(prev), 0);
          return prev;
        } else {
          return [];
        }
      }

      // If clicking second-to-last letter, backspace 1 letter
      if (prev.length >= 2 && prev[prev.length - 2].index === index) {
        playSelectLetter(Math.max(0, prev.length - 2));
        return prev.slice(0, -1);
      }

      if (prev.some(w => w.index === index)) return prev;

      if (prev.length === 0) {
        playSelectLetter(0);
        return [{ index, letter }];
      }

      const lastIndex = prev[prev.length - 1].index;
      if (isAdjacent(lastIndex, index, gridSize)) {
        playSelectLetter(prev.length);
        return [...prev, { index, letter }];
      }

      // Tapping a non-adjacent tile starts a new selection
      playSelectLetter(0);
      return [{ index, letter }];
    });
  };

  const processDragMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current || status !== 'playing' || timeLeft === 0) return;
    const index = getTileIndexFromCoords(clientX, clientY);
    if (index === null) return;

    setCurrentWord(prev => {
      if (prev.length === 0) {
        const letter = board[index];
        if (!letter) return prev;
        playSelectLetter(0);
        return [{ index, letter }];
      }
      const lastIndex = prev[prev.length - 1].index;
      if (index === lastIndex) return prev;

      // Handle direct backspacing
      if (prev.length >= 2 && prev[prev.length - 2].index === index) {
        playSelectLetter(Math.max(0, prev.length - 2));
        return prev.slice(0, -1);
      }

      // Step-by-step interpolation between lastIndex and target index
      const size = gridSize || 4;
      const startRow = Math.floor(lastIndex / size);
      const startCol = lastIndex % size;
      const targetRow = Math.floor(index / size);
      const targetCol = index % size;

      let currRow = startRow;
      let currCol = startCol;
      let newWord = [...prev];
      let changed = false;

      while (currRow !== targetRow || currCol !== targetCol) {
        const dr = Math.sign(targetRow - currRow);
        const dc = Math.sign(targetCol - currCol);
        currRow += dr;
        currCol += dc;
        const nextIdx = currRow * size + currCol;

        // Check if backspacing along path
        if (newWord.length >= 2 && newWord[newWord.length - 2].index === nextIdx) {
          newWord = newWord.slice(0, -1);
          changed = true;
          continue;
        }

        // Cannot revisit a tile already in path
        if (newWord.some(w => w.index === nextIdx)) {
          break;
        }

        const l = board[nextIdx];
        if (!l) break;

        newWord.push({ index: nextIdx, letter: l });
        changed = true;
      }

      if (changed) {
        playSelectLetter(newWord.length - 1);
        return newWord;
      }

      return prev;
    });
  };

  const endDrag = (e?: React.SyntheticEvent) => {
    if (!isDraggingRef.current) return;
    if (e && e.cancelable) e.preventDefault();
    isDraggingRef.current = false;

    setCurrentWord(currentList => {
      if (currentList.length >= minWordLength) {
        setTimeout(() => submitOfflineWord(currentList), 0);
      }
      return currentList;
    });
  };

  useEffect(() => {
    const handleWindowTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current && e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        processDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleWindowMouseMove = (e: MouseEvent | PointerEvent) => {
      if (isDraggingRef.current) {
        if (e.cancelable) e.preventDefault();
        processDragMove(e.clientX, e.clientY);
      }
    };
    const handleWindowTouchEnd = (e: TouchEvent) => {
      if (isDraggingRef.current) {
        if (e.cancelable) e.preventDefault();
        endDrag();
      }
    };
    const handleWindowPointerUp = () => {
      if (isDraggingRef.current) {
        endDrag();
      }
    };

    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('mousemove', handleWindowMouseMove, { passive: false });
    window.addEventListener('pointermove', handleWindowMouseMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('mouseup', handleWindowPointerUp);

    return () => {
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('pointermove', handleWindowMouseMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('mouseup', handleWindowPointerUp);
    };
  }, [status, timeLeft]);

  const totalScore = words.reduce((sum, w) => sum + w.score, 0);

  // Mock player object for Replay compatibility
  const soloPlayer = [{
    id: (user?.uid || 'solo') as string,
    name: (profile?.name || user?.displayName || 'Você') as string,
    words: words,
    score: totalScore
  }];

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-3 sm:p-4 md:p-8 select-none ${isFakeFullscreen ? 'fixed inset-0 z-[100] overflow-y-auto w-full h-full' : ''}`}>
      <div className="max-w-4xl mx-auto flex flex-col gap-5 sm:gap-6">
        <header className="bg-[#141414] p-4 sm:p-6 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-[#222] flex flex-wrap gap-3 justify-between items-center">
          <div>
            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#00FF00] bg-[#00FF00]/10 px-2 py-0.5 rounded border border-[#00FF00]/30">LOUD BOOGLE</span>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-100 uppercase tracking-widest mt-0.5 sm:mt-1">Modo Treino</h1>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <button 
              onClick={toggleFullscreen} 
              className="p-2.5 bg-[#1a1a1a] hover:bg-[#222] text-zinc-400 hover:text-zinc-200 rounded-xl border border-[#333] transition"
              title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <button 
              onClick={handleToggleMute} 
              className="p-2.5 bg-[#1a1a1a] hover:bg-[#222] text-zinc-400 hover:text-zinc-200 rounded-xl border border-[#333] transition"
              title={muted ? "Ativar Som" : "Silenciar Som"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={onLeave} className="px-3 sm:px-4 py-2 bg-[#1a1a1a] text-zinc-400 font-bold uppercase tracking-widest text-xs sm:text-sm rounded-xl hover:bg-[#222] border border-[#333] transition flex items-center gap-2">
              <ArrowLeft size={16} /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        {status === 'waiting' && (
          <div className="bg-[#141414] p-8 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-[#222] text-center">
            <h2 className="text-2xl font-black mb-4 uppercase tracking-widest text-zinc-100">Pronto para treinar?</h2>
            <button onClick={startGame} className="bg-[#00FF00] text-black px-8 py-4 rounded-xl font-black hover:bg-[#00e600] transition flex items-center gap-2 mx-auto uppercase tracking-widest shadow-[0_0_15px_rgba(0,255,0,0.2)]">
              <Play size={24} /> Começar Treino
            </button>
          </div>
        )}

        {status === 'playing' && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 bg-[#141414] p-6 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-[#222] flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-6">
                <AnimatedTimer
                  timeLeft={timeLeft}
                  totalDuration={duration}
                  size="md"
                  showProgressRing={true}
                />
                <div className="text-2xl font-black text-[#00FF00] drop-shadow-[0_0_10px_rgba(0,255,0,0.2)]">{totalScore} <span className="text-xs text-zinc-600 font-bold uppercase tracking-widest">pts</span></div>
              </div>
              
              <div className="mb-4 h-12 flex flex-col items-center justify-center w-full relative py-2">
                <div className="absolute top-0 right-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">
                  Mínimo: {minWordLength} Letras
                </div>
                {currentWord.length > 0 ? (
                  <div className="text-3xl font-black tracking-widest uppercase text-[#00FF00] drop-shadow-[0_0_10px_rgba(0,255,0,0.2)] flex items-center justify-center gap-2 mt-2">
                    <span>{currentWord.map(w => w.letter).join('')}</span>
                    <div className="flex items-center gap-1.5 ml-2">
                      {/* Auto-submit e tap-to-clear removes need for buttons */}
                    </div>
                  </div>
                ) : message ? (
                  <div className={`flex items-center gap-2 font-black px-4 py-2 rounded-xl text-sm uppercase tracking-widest border mt-2 ${message.type === 'error' ? 'bg-red-900/20 text-red-500 border-red-500/30' : 'bg-[#00FF00]/10 text-[#00FF00] border-[#00FF00]/30'}`}>
                    {message.type === 'error' ? <X size={20} strokeWidth={3} /> : <Check size={20} strokeWidth={3} />}
                    {message.text}
                    {message.word && (
                      <button onClick={() => handleSuggest(message.word!)} className="ml-2 text-[10px] bg-red-900/50 text-red-300 px-2 py-1 rounded hover:bg-red-900 transition border border-red-500/30">
                        SUGERIR
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-1 text-[#333] tracking-[0.2em] mt-2 text-3xl font-black">
                    {Array.from({ length: minWordLength }).map((_, i) => <span key={i}>_</span>)}
                  </div>
                )}
              </div>

              <div 
                ref={gridRef}
                className="grid gap-2 md:gap-3 bg-[#0a0a0a] p-4 md:p-6 rounded-3xl touch-none select-none border border-[#222] shadow-inner aspect-square w-full max-w-xl mx-auto"
                style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`, touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
              >
                {board.map((letter: string, index: number) => {
                  const isSelected = currentWord.some(w => w.index === index);
                  const isLast = currentWord.length > 0 && currentWord[currentWord.length - 1].index === index;
                  const textSizeClass = gridSize === 4 ? 'text-3xl md:text-4xl' : gridSize === 5 ? 'text-2xl md:text-3xl' : gridSize === 6 ? 'text-xl md:text-2xl' : gridSize === 7 ? 'text-lg md:text-xl' : 'text-sm md:text-base';
                  
                  return (
                    <div 
                      key={index}
                      data-index={index}
                      data-letter={letter}
                      onTouchStart={(e) => startDrag(index, letter, e)}
                      onPointerDown={(e) => startDrag(index, letter, e)}
                      onMouseDown={(e) => startDrag(index, letter, e)}
                      style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                      className={`
                        flex items-center justify-center font-black uppercase rounded-2xl cursor-pointer select-none touch-none transition-all shadow-[0_4px_0_0_rgba(0,0,0,0.8)] ${textSizeClass}
                        ${isSelected ? 'bg-[#00FF00] text-black shadow-none translate-y-1' : 'bg-[#1a1a1a] text-zinc-100 hover:bg-[#222] border border-[#333] active:translate-y-1 active:shadow-none'}
                        ${isLast ? 'ring-4 ring-white/50' : ''}
                      `}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-full md:w-80 flex flex-col gap-4">
              <div className="bg-[#141414] p-6 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-[#222] flex-1">
                <h3 className="font-black text-zinc-100 mb-4 pb-2 border-b border-[#333] uppercase tracking-widest text-sm">Palavras ({words.length})</h3>
                <div className="overflow-y-auto max-h-[400px] flex flex-col gap-2 pr-2">
                  {words.map((w, i) => (
                    <div key={i} className="flex justify-between items-center p-2 hover:bg-[#1a1a1a] border border-transparent hover:border-[#333] rounded-lg transition-colors">
                      <span className="font-black text-zinc-300 uppercase tracking-widest">{w.word}</span>
                      <span className="font-black text-[#00FF00] bg-[#00FF00]/10 border border-[#00FF00]/30 px-2 py-1 rounded text-xs tracking-widest">{w.score} pts</span>
                    </div>
                  ))}
                  {words.length === 0 && (
                    <p className="text-zinc-600 text-sm font-bold uppercase tracking-widest text-center py-4">Nenhuma palavra encontrada ainda.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {status === 'gameover' && (
          <div className="flex flex-col gap-6 animate-in fade-in zoom-in duration-500">
            <div className="bg-[#141414] p-6 rounded-3xl border border-[#222] flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
              <div>
                <h2 className="text-3xl font-black text-[#00FF00] uppercase tracking-widest drop-shadow-[0_0_15px_rgba(0,255,0,0.3)]">Treino Concluído!</h2>
                <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-1">Pontuação Final: {totalScore} pontos • {words.length} palavras</p>
              </div>
              <button onClick={restartGame} className="w-full md:w-auto bg-[#00FF00] text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-[#00e600] transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                <RotateCcw size={18} /> Treinar Novamente
              </button>
            </div>

            {/* Board Replay for Solo / Offline Training */}
            <BoardReplay 
              board={board} 
              gridSize={gridSize} 
              players={soloPlayer}
            />
          </div>
        )}
      </div>
    </div>
  );
}
