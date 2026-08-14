import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateBoard, validateWord, isAdjacent } from '../lib/boggle';
import { Play, Check, X, ArrowLeft, Clock } from 'lucide-react';
import { suggestWord } from '../lib/room';

export default function OfflineRoom({ onLeave, duration = 180, gridSize = 4, minWordLength = 3 }: { onLeave: () => void, duration?: number, gridSize?: number, minWordLength?: number }) {
  const [board, setBoard] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [status, setStatus] = useState<'waiting' | 'playing' | 'gameover'>('waiting');
  
  const [currentWord, setCurrentWord] = useState<{index: number, letter: string}[]>([]);
  const [words, setWords] = useState<{word: string, score: number}[]>([]);
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error', word?: string} | null>(null);
  
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'waiting') {
      setBoard(generateBoard(gridSize));
      setTimeLeft(duration);
      setWords([]);
      setCurrentWord([]);
      setMessage(null);
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
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, timeLeft]);

  const startGame = () => setStatus('playing');
  const restartGame = () => setStatus('waiting');

  const handleSuggest = async (word: string) => {
    await suggestWord(word, 'offline-user');
    setMessage({ text: 'Palavra sugerida com sucesso!', type: 'success' });
  };

  const handlePointerDown = (e: React.PointerEvent, index: number, letter: string) => {
    if (status !== 'playing' || timeLeft === 0) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setCurrentWord([{ index, letter }]);
    setMessage(null);
  };

  const handlePointerEnter = (index: number, letter: string) => {
    if (status !== 'playing' || timeLeft === 0 || currentWord.length === 0) return;
    const lastIndex = currentWord[currentWord.length - 1].index;
    
    if (currentWord.some(w => w.index === index)) {
      if (currentWord.length > 1 && currentWord[currentWord.length - 2].index === index) {
        setCurrentWord(prev => prev.slice(0, -1));
      }
      return;
    }

    if (isAdjacent(lastIndex, index, gridSize)) {
      setCurrentWord(prev => [...prev, { index, letter }]);
    }
  };

  const handlePointerUp = async () => {
    if (status !== 'playing' || timeLeft === 0 || currentWord.length === 0) return;
    
    const wordStr = currentWord.map(w => w.letter).join('');
    setCurrentWord([]);

    if (wordStr.length < minWordLength) {
      setMessage({ text: `Muito curta! Mínimo de ${minWordLength} letras.`, type: 'error' });
      return;
    }

    if (words.some(w => w.word === wordStr)) {
      setMessage({ text: 'Palavra já encontrada!', type: 'error' });
      return;
    }

    const isValid = await validateWord(wordStr);
    if (isValid) {
      const score = Math.max(1, wordStr.length - 2);
      setWords(prev => [{word: wordStr, score}, ...prev]);
      setMessage({ text: 'Palavra válida!', type: 'success' });
    } else {
      setMessage({ text: 'Palavra não encontrada.', type: 'error', word: wordStr });
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const totalScore = words.reduce((sum, w) => sum + w.score, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-4 md:p-8 select-none">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <header className="bg-[#141414] p-6 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-[#222] flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#00FF00] bg-[#00FF00]/10 px-2 py-0.5 rounded border border-[#00FF00]/30">LOUD BOOGLE</span>
            <h1 className="text-2xl font-black text-zinc-100 uppercase tracking-widest mt-1">Modo Treino</h1>
          </div>
          <div className="flex gap-4 items-center">
            <button onClick={onLeave} className="px-4 py-2 bg-[#1a1a1a] text-zinc-400 font-bold uppercase tracking-widest text-sm rounded-xl hover:bg-[#222] border border-[#333] transition flex items-center gap-2">
              <ArrowLeft size={20} /> Sair
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

        {(status === 'playing' || status === 'gameover') && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 bg-[#141414] p-6 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.8)] border border-[#222] flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-6">
                <div className="text-2xl font-black font-mono flex items-center gap-2">
                  <Clock size={24} className={timeLeft <= 10 ? 'text-red-500' : 'text-[#00FF00]'} />
                  <span className={timeLeft <= 10 ? 'text-red-500 animate-pulse drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-[#00FF00] drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]'}>{formatTime(timeLeft)}</span>
                </div>
                <div className="text-2xl font-black text-[#00FF00] drop-shadow-[0_0_10px_rgba(0,255,0,0.2)]">{totalScore} <span className="text-xs text-zinc-600 font-bold uppercase tracking-widest">pts</span></div>
              </div>
              
              <div className="mb-4 h-12 flex items-center justify-center w-full">
                {currentWord.length > 0 ? (
                  <div className="text-3xl font-black tracking-widest uppercase text-[#00FF00] drop-shadow-[0_0_10px_rgba(0,255,0,0.2)]">
                    {currentWord.map(w => w.letter).join('')}
                  </div>
                ) : message ? (
                  <div className={`flex items-center gap-2 font-black px-4 py-2 rounded-xl text-sm uppercase tracking-widest border ${message.type === 'error' ? 'bg-red-900/20 text-red-500 border-red-500/30' : 'bg-[#00FF00]/10 text-[#00FF00] border-[#00FF00]/30'}`}>
                    {message.type === 'error' ? <X size={20} strokeWidth={3} /> : <Check size={20} strokeWidth={3} />}
                    {message.text}
                    {message.word && (
                      <button onClick={() => handleSuggest(message.word!)} className="ml-2 text-[10px] bg-red-900/50 text-red-300 px-2 py-1 rounded hover:bg-red-900 transition border border-red-500/30">
                        SUGERIR
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-zinc-600 font-bold text-sm uppercase tracking-widest">Deslize para formar palavras</div>
                )}
              </div>

              <div 
                ref={boardRef}
                className="grid gap-2 md:gap-3 bg-[#0a0a0a] p-4 md:p-6 rounded-3xl touch-none border border-[#222] shadow-inner aspect-square w-full max-w-xl mx-auto"
                style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
                onPointerLeave={handlePointerUp}
                onPointerUp={handlePointerUp}
              >
                {board.map((letter: string, index: number) => {
                  const isSelected = currentWord.some(w => w.index === index);
                  const isLast = currentWord.length > 0 && currentWord[currentWord.length - 1].index === index;
                  const textSizeClass = gridSize === 4 ? 'text-3xl md:text-4xl' : gridSize === 5 ? 'text-2xl md:text-3xl' : gridSize === 6 ? 'text-xl md:text-2xl' : 'text-lg md:text-xl';
                  
                  return (
                    <div 
                      key={index}
                      onPointerDown={(e) => handlePointerDown(e, index, letter)}
                      onPointerEnter={() => handlePointerEnter(index, letter)}
                      className={`
                        flex items-center justify-center font-black uppercase rounded-2xl cursor-pointer select-none transition-all shadow-[0_4px_0_0_rgba(0,0,0,0.8)] ${textSizeClass}
                        ${isSelected ? 'bg-[#00FF00] text-black shadow-none translate-y-1' : 'bg-[#1a1a1a] text-zinc-100 hover:bg-[#222] border border-[#333] active:translate-y-1 active:shadow-none'}
                        ${isLast ? 'ring-4 ring-white/50' : ''}
                      `}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>

              {status === 'gameover' && (
                <div className="mt-8 text-center animate-in fade-in zoom-in">
                  <h2 className="text-3xl font-black mb-4 text-[#00FF00] uppercase tracking-widest drop-shadow-[0_0_15px_rgba(0,255,0,0.3)]">Tempo Esgotado!</h2>
                  <button onClick={restartGame} className="bg-[#111] border border-[#333] text-zinc-300 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-[#222] transition">
                    Treinar Novamente
                  </button>
                </div>
              )}
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
      </div>
    </div>
  );
}
