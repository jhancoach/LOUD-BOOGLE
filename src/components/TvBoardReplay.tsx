import React, { useState, useEffect, useMemo } from 'react';
import { findWordPath, getScore } from '../lib/boggle';
import { playSelectLetter, playWordSuccess } from '../lib/sounds';
import { Crown, Trophy, User, Check, Sparkles } from 'lucide-react';

interface TvBoardReplayProps {
  board: string[];
  gridSize: number;
  players: {
    id: string;
    name: string;
    words: { word: string; score?: number }[];
  }[];
  onClose?: () => void;
}

type PlaybackSpeed = 'slow' | 'fast';

const SPEED_CONFIG: Record<PlaybackSpeed, { label: string; letterDelay: number; wordPause: number; icon: string }> = {
  slow: { label: 'Lenta', letterDelay: 380, wordPause: 2500, icon: '🐢' },
  fast: { label: 'Rápida', letterDelay: 120, wordPause: 800, icon: '🚀' },
};

export default function TvBoardReplay({ board, gridSize = 4, players, onClose }: TvBoardReplayProps) {
  // Aggregate words for playback
  const allWordRecords = useMemo(() => {
    const map = new Map<string, { word: string; score: number; playerIds: string[] }>();
    players.forEach(p => {
      (p.words || []).forEach(w => {
        const clean = (typeof w === 'string' ? w : w.word).toUpperCase();
        if (!clean) return;
        const score = getScore(clean);
        if (!map.has(clean)) {
          map.set(clean, { word: clean, score, playerIds: [p.id] });
        } else {
          const entry = map.get(clean)!;
          if (!entry.playerIds.includes(p.id)) {
            entry.playerIds.push(p.id);
          }
        }
      });
    });
    // Sort words by score ascending, so the best words are at the end, building tension!
    // Or maybe just random? Let's sort by score ascending, then alphabetically
    return Array.from(map.values()).sort((a, b) => a.score - b.score || a.word.localeCompare(b.word));
  }, [players]);

  const totalWords = allWordRecords.length;

  const [speed, setSpeed] = useState<PlaybackSpeed>('fast');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [wordIndex, setWordIndex] = useState<number>(0);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  
  // Player scores progress
  const [playerProgress, setPlayerProgress] = useState<Record<string, { score: number; count: number }>>(() => {
    const init: Record<string, { score: number; count: number }> = {};
    players.forEach(p => init[p.id] = { score: 0, count: 0 });
    return init;
  });

  const currentWordItem = allWordRecords[wordIndex] || null;
  
  // Calculate path
  const currentPath = useMemo(() => {
    if (!currentWordItem || !board || board.length === 0) return [];
    const path = findWordPath(currentWordItem.word, board, gridSize);
    return path || [];
  }, [currentWordItem, board, gridSize]);

  // Main playback effect
  useEffect(() => {
    if (!isPlaying || wordIndex >= totalWords) return;

    const config = SPEED_CONFIG[speed];
    let letterTimer: NodeJS.Timeout;
    let nextWordTimer: NodeJS.Timeout;

    if (activeStepIndex < currentPath.length - 1) {
      letterTimer = setTimeout(() => {
        setActiveStepIndex(prev => prev + 1);
        playSelectLetter(activeStepIndex + 1);
      }, config.letterDelay);
    } else {
      // Word finished animating
      if (activeStepIndex === currentPath.length - 1) {
        // Just finished the last letter, play success and update scores
        playWordSuccess(currentWordItem?.score || 0);
        
        setPlayerProgress(prev => {
          const next = { ...prev };
          currentWordItem.playerIds.forEach(pid => {
            if (next[pid]) {
              next[pid] = {
                score: next[pid].score + currentWordItem.score,
                count: next[pid].count + 1
              };
            }
          });
          return next;
        });

        // Set to -2 to pause before next word
        setActiveStepIndex(-2);
      }

      nextWordTimer = setTimeout(() => {
        setWordIndex(prev => prev + 1);
        setActiveStepIndex(-1);
      }, config.wordPause);
    }

    return () => {
      clearTimeout(letterTimer);
      clearTimeout(nextWordTimer);
    };
  }, [wordIndex, activeStepIndex, isPlaying, currentPath.length, speed, totalWords, currentWordItem]);

  // Max score for podium scaling
  const maxScore = Math.max(10, ...Object.values(playerProgress).map(p => p.score));
  
  // Sort players for podium rendering (by current score)
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = playerProgress[a.id]?.score || 0;
    const scoreB = playerProgress[b.id]?.score || 0;
    return scoreB - scoreA;
  });

  const isFinished = wordIndex >= totalWords;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0a0a0a] text-white font-sans overflow-hidden p-6 pb-0 animate-in fade-in duration-500">
      
      {/* Top Header / Settings */}
      <div className="flex justify-between items-center w-full relative z-20 mb-4">
        <div className="flex items-center gap-4 bg-[#111] p-3 rounded-2xl border border-[#222]">
           <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Velocidade:</span>
           {(['slow', 'fast'] as PlaybackSpeed[]).map(s => {
              const cfg = SPEED_CONFIG[s];
              const isCurr = speed === s;
              return (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 ${
                    isCurr
                      ? 'bg-[#00FF00] text-black shadow-[0_0_15px_rgba(0,255,0,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#222]'
                  }`}
                >
                  <span>{cfg.icon}</span> {cfg.label}
                </button>
              );
            })}
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="ml-2 px-4 py-1.5 bg-[#222] hover:bg-[#333] border border-[#333] rounded-lg text-xs font-black uppercase tracking-widest transition"
            >
              {isPlaying ? 'Pausar' : 'Continuar'}
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="ml-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-black uppercase tracking-widest transition text-white"
              >
                Fechar
              </button>
            )}
        </div>
        <div className="text-right bg-[#111] p-3 rounded-2xl border border-[#222]">
           <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Palavras Contadas</p>
           <p className="text-2xl font-black text-[#00FF00] leading-none">
             {Math.min(wordIndex, totalWords)} <span className="text-sm text-zinc-500">/ {totalWords}</span>
           </p>
        </div>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full mb-8">
         
         <div className="relative group mb-6">
            <div className="absolute inset-0 bg-white/5 blur-[50px] rounded-full scale-110 pointer-events-none"></div>
            <div 
              className="grid gap-2 sm:gap-3 bg-[#111] p-4 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-2 border-[#222] aspect-square max-w-[400px] w-full relative z-10 transition-transform duration-300"
              style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
            >
              {board.map((letter, idx) => {
                const pathIndex = currentPath.indexOf(idx);
                const isInPath = pathIndex !== -1 && pathIndex <= activeStepIndex;
                const isCurrentActiveLetter = pathIndex === activeStepIndex && activeStepIndex >= 0;
                
                return (
                  <div 
                    key={idx}
                    className={`flex items-center justify-center font-black uppercase rounded-2xl text-4xl sm:text-5xl transition-all duration-200 ${
                      isCurrentActiveLetter
                        ? 'bg-yellow-400 text-black scale-105 shadow-[0_0_20px_rgba(250,204,21,0.6)] z-20 rotate-3'
                        : isInPath
                        ? 'bg-[#00FF00] text-black shadow-[0_0_15px_rgba(0,255,0,0.3)] scale-105'
                        : 'bg-[#1a1a1a] text-zinc-400 border border-[#2a2a2a] shadow-inner'
                    }`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
         </div>

         {/* Current Word Display */}
         <div className="h-20 flex items-center justify-center">
            {currentWordItem && (
               <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 flex items-center gap-4 bg-gradient-to-r from-[#2D164D] to-[#4c1d95] px-8 py-3 rounded-full border-2 border-[#6d28d9] shadow-[0_0_30px_rgba(109,40,217,0.5)]">
                 <span className="text-3xl font-black uppercase tracking-[0.2em] text-white">
                   {currentWordItem.word}
                 </span>
                 <div className="bg-white/20 text-white px-3 py-1 rounded-xl text-xl font-black">
                   +{currentWordItem.score}
                 </div>
               </div>
            )}
            {isFinished && (
               <div className="animate-in zoom-in fade-in duration-500 flex items-center gap-4 bg-[#00FF00]/20 px-8 py-4 rounded-full border-2 border-[#00FF00] shadow-[0_0_40px_rgba(0,255,0,0.3)]">
                 <Trophy className="text-[#00FF00]" size={32} />
                 <span className="text-2xl font-black uppercase tracking-[0.2em] text-[#00FF00]">
                   Resultados Finais!
                 </span>
               </div>
            )}
         </div>
         
         {/* Who found it bubbles */}
         <div className="h-12 flex flex-wrap justify-center gap-3 mt-4">
           {currentWordItem && currentWordItem.playerIds.map(pid => {
             const p = players.find(x => x.id === pid);
             if (!p) return null;
             return (
               <div key={pid} className="bg-white/10 text-white px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider animate-in zoom-in fade-in border border-white/20 flex items-center gap-2">
                 <User size={14} className="text-yellow-400" />
                 {p.name}
               </div>
             );
           })}
         </div>

      </div>

      {/* Podium Bottom Area */}
      <div className="w-full flex items-end justify-center gap-2 sm:gap-6 px-4 h-[35vh] relative z-20 pb-0 border-b-0">
         {sortedPlayers.map((p, index) => {
           const prog = playerProgress[p.id];
           // Calculate height percentage, max 90% min 15%
           const heightPercent = maxScore > 0 ? Math.max(15, (prog.score / maxScore) * 90) : 15;
           const isWinner = isFinished && index === 0 && prog.score > 0;
           
           return (
             <div 
               key={p.id} 
               className="flex flex-col items-center justify-end w-32 sm:w-40 transition-all duration-1000 ease-in-out"
               style={{ height: '100%' }}
             >
                {/* Floating Avatar & Stats */}
                <div className={`flex flex-col items-center mb-3 transition-transform duration-700 ${isWinner ? 'scale-125 -translate-y-4' : ''}`}>
                   {isWinner && <Crown size={32} className="text-yellow-400 mb-2 animate-bounce" />}
                   
                   <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center shadow-2xl border-4 transition-colors duration-500 ${
                     isWinner ? 'bg-yellow-400 border-white text-black' : 'bg-[#1a1a1a] border-[#333] text-zinc-500'
                   }`}>
                      <User size={40} />
                   </div>
                   
                   <div className="text-center mt-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/10">
                     <div className="font-black text-sm sm:text-base uppercase tracking-wider text-white truncate max-w-[120px]">{p.name}</div>
                     <div className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-zinc-400">{prog.count} palavras</div>
                   </div>
                </div>

                {/* Podium Bar */}
                <div 
                  className={`w-full rounded-t-3xl transition-all duration-1000 ease-out border-t-4 border-l-2 border-r-2 flex flex-col items-center pt-4 relative overflow-hidden ${
                    isWinner 
                      ? 'bg-gradient-to-t from-yellow-600 to-yellow-400 border-yellow-200' 
                      : index === 1
                      ? 'bg-gradient-to-t from-zinc-700 to-zinc-400 border-zinc-200'
                      : index === 2
                      ? 'bg-gradient-to-t from-orange-900 to-orange-600 border-orange-300'
                      : 'bg-gradient-to-t from-[#111] to-[#222] border-[#333]'
                  }`}
                  style={{ height: `${heightPercent}%`, minHeight: '60px' }}
                >
                   {/* Score Number inside bar */}
                   <span className={`text-2xl sm:text-3xl font-black drop-shadow-md z-10 ${isWinner ? 'text-black' : 'text-white'}`}>
                     {prog.score}
                   </span>
                   
                   {/* Inner glow/pattern for the bar */}
                   <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none mix-blend-overlay"></div>
                </div>
             </div>
           );
         })}
      </div>

    </div>
  );
}
