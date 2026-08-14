import React, { useState, useEffect, useMemo, useRef } from 'react';
import { findWordPath, getScore } from '../lib/boggle';
import { playReplayStep, playSelectLetter, playWordSuccess } from '../lib/sounds';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FastForward, Sparkles, User, Check, Eye } from 'lucide-react';

export interface PlayerWordRecord {
  word: string;
  score?: number;
  playerName?: string;
  playerId?: string;
  path?: number[];
}

interface BoardReplayProps {
  board: string[];
  gridSize: number;
  players: {
    id: string;
    name: string;
    words: { word: string; score?: number }[];
  }[];
  currentUserId?: string;
}

type PlaybackSpeed = 'slow' | 'normal' | 'fast';

const SPEED_CONFIG: Record<PlaybackSpeed, { label: string; letterDelay: number; wordPause: number; icon: string }> = {
  slow: { label: 'Lenta', letterDelay: 380, wordPause: 1800, icon: '🐢' },
  normal: { label: 'Normal', letterDelay: 200, wordPause: 1000, icon: '⚡' },
  fast: { label: 'Rápida', letterDelay: 90, wordPause: 400, icon: '🚀' },
};

export default function BoardReplay({ board, gridSize = 4, players, currentUserId }: BoardReplayProps) {
  // Aggregate and deduplicate all words with metadata
  const allWordRecords = useMemo(() => {
    const map = new Map<string, { word: string; score: number; foundBy: string[]; playerIds: string[] }>();
    
    players.forEach(p => {
      (p.words || []).forEach(w => {
        const clean = (typeof w === 'string' ? w : w.word).toUpperCase();
        if (!clean) return;
        const score = getScore(clean);
        if (!map.has(clean)) {
          map.set(clean, {
            word: clean,
            score,
            foundBy: [p.name],
            playerIds: [p.id]
          });
        } else {
          const entry = map.get(clean)!;
          if (!entry.foundBy.includes(p.name)) {
            entry.foundBy.push(p.name);
            entry.playerIds.push(p.id);
          }
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  }, [players]);

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'mine' | string>('all');
  const [speed, setSpeed] = useState<PlaybackSpeed>('normal');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1); // Which letter in the word is currently active

  // Filtered word list
  const filteredWords = useMemo(() => {
    if (selectedFilter === 'all') return allWordRecords;
    if (selectedFilter === 'mine' && currentUserId) {
      return allWordRecords.filter(w => w.playerIds.includes(currentUserId));
    }
    return allWordRecords.filter(w => w.foundBy.includes(selectedFilter));
  }, [allWordRecords, selectedFilter, currentUserId]);

  const currentWordItem = filteredWords[selectedIndex] || null;

  // Compute the path on the board for the current word
  const currentPath = useMemo(() => {
    if (!currentWordItem || !board || board.length === 0) return [];
    return findWordPath(currentWordItem.word, board, gridSize) || [];
  }, [currentWordItem, board, gridSize]);

  // Keep selected index valid
  useEffect(() => {
    if (selectedIndex >= filteredWords.length) {
      setSelectedIndex(0);
    }
    setActiveStepIndex(-1);
  }, [filteredWords.length]);

  // Handle letter-by-letter animation and autoplay
  useEffect(() => {
    let letterTimer: any = null;
    let nextWordTimer: any = null;

    if (!currentWordItem || currentPath.length === 0) {
      setActiveStepIndex(-1);
      return;
    }

    const config = SPEED_CONFIG[speed];

    // Animate letters in sequence
    let currentStep = 0;
    setActiveStepIndex(0);
    playSelectLetter(0);

    const stepInterval = setInterval(() => {
      currentStep++;
      if (currentStep < currentPath.length) {
        setActiveStepIndex(currentStep);
        playSelectLetter(currentStep);
      } else {
        clearInterval(stepInterval);
        setActiveStepIndex(currentPath.length - 1);
        playWordSuccess(currentWordItem.score);

        // If in autoplay mode, advance to next word after wordPause
        if (isPlaying) {
          nextWordTimer = setTimeout(() => {
            setSelectedIndex(prev => (prev + 1) % filteredWords.length);
          }, config.wordPause);
        }
      }
    }, config.letterDelay);

    return () => {
      clearInterval(stepInterval);
      if (letterTimer) clearTimeout(letterTimer);
      if (nextWordTimer) clearTimeout(nextWordTimer);
    };
  }, [selectedIndex, speed, isPlaying, currentWordItem?.word, currentPath.length, filteredWords.length]);

  const handleSelectWord = (index: number) => {
    setSelectedIndex(index);
    setActiveStepIndex(-1);
  };

  const handleNext = () => {
    if (filteredWords.length === 0) return;
    setSelectedIndex(prev => (prev + 1) % filteredWords.length);
    playReplayStep();
  };

  const handlePrev = () => {
    if (filteredWords.length === 0) return;
    setSelectedIndex(prev => (prev - 1 + filteredWords.length) % filteredWords.length);
    playReplayStep();
  };

  const handleRestartCurrent = () => {
    setActiveStepIndex(-1);
    // Trigger re-render of effect
    setSelectedIndex(i => i);
    playReplayStep();
  };

  if (allWordRecords.length === 0) {
    return (
      <div className="bg-[#111] p-8 rounded-3xl border border-[#222] text-center max-w-xl mx-auto shadow-2xl">
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">Nenhuma palavra foi encontrada nesta rodada.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111111] border border-[#222] rounded-3xl p-4 md:p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col lg:flex-row gap-6 w-full max-w-5xl mx-auto">
      {/* Left Column: Interactive Replay Board */}
      <div className="flex-1 flex flex-col items-center">
        {/* Header with Title & Speed Switcher */}
        <div className="w-full flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#00FF00]/10 text-[#00FF00] rounded-xl border border-[#00FF00]/30">
              <Eye size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                Replay do Tabuleiro
              </h3>
              <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">
                Trajetória visual das palavras
              </p>
            </div>
          </div>

          {/* Speed Toggle Controls */}
          <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-xl border border-[#2a2a2a]">
            <span className="text-[10px] font-black uppercase text-zinc-500 px-2">Velocidade:</span>
            {(['slow', 'normal', 'fast'] as PlaybackSpeed[]).map(s => {
              const cfg = SPEED_CONFIG[s];
              const isCurr = speed === s;
              return (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1 ${
                    isCurr
                      ? 'bg-[#00FF00] text-black shadow-[0_0_12px_rgba(0,255,0,0.3)]'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#222]'
                  }`}
                  title={`Velocidade ${cfg.label}`}
                >
                  <span>{cfg.icon}</span> {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* The Visual Boggle Board */}
        <div 
          className="grid gap-2 p-3 bg-[#0a0a0a] rounded-2xl border-2 border-[#222] shadow-[0_0_30px_rgba(0,0,0,0.9)] w-full max-w-[340px] aspect-square"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`
          }}
        >
          {board.map((letter, idx) => {
            const pathIndex = currentPath.indexOf(idx);
            const isInPath = pathIndex !== -1;
            const isCurrentActiveLetter = isInPath && pathIndex === activeStepIndex;
            const isPastActiveLetter = isInPath && pathIndex <= activeStepIndex;
            const isStart = pathIndex === 0;

            let cellBg = 'bg-[#181818] text-zinc-400 border-[#2a2a2a]';
            let glow = '';

            if (isCurrentActiveLetter) {
              cellBg = 'bg-[#00FF00] text-black font-black border-[#00FF00] scale-105 z-10';
              glow = 'shadow-[0_0_25px_rgba(0,255,0,0.8)]';
            } else if (isPastActiveLetter) {
              cellBg = isStart
                ? 'bg-[#00FF00]/30 text-[#00FF00] border-[#00FF00] font-black'
                : 'bg-[#00FF00]/20 text-zinc-100 border-[#00FF00]/60 font-black';
              glow = 'shadow-[0_0_15px_rgba(0,255,0,0.2)]';
            }

            return (
              <div
                key={idx}
                className={`relative flex items-center justify-center rounded-xl font-mono text-2xl md:text-3xl font-black uppercase transition-all duration-200 border select-none ${cellBg} ${glow}`}
              >
                {letter}

                {/* Step badge in corner */}
                {isPastActiveLetter && (
                  <span className={`absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-mono font-bold flex items-center justify-center ${
                    isCurrentActiveLetter ? 'bg-black text-[#00FF00]' : 'bg-[#00FF00] text-black'
                  }`}>
                    {pathIndex + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Current Word Info Badge */}
        {currentWordItem ? (
          <div className="mt-4 w-full max-w-[340px] bg-[#161616] p-3 rounded-2xl border border-[#2a2a2a] flex items-center justify-between shadow-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-widest text-[#00FF00] uppercase font-mono">
                  {currentWordItem.word}
                </span>
                <span className="bg-[#00FF00]/20 text-[#00FF00] text-xs font-black px-2 py-0.5 rounded-full border border-[#00FF00]/30">
                  +{currentWordItem.score} {currentWordItem.score === 1 ? 'pt' : 'pts'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider mt-0.5 truncate max-w-[190px]">
                Encontrada por: <span className="text-zinc-200">{currentWordItem.foundBy.join(', ')}</span>
              </p>
            </div>

            <button
              onClick={handleRestartCurrent}
              className="p-2 bg-[#222] hover:bg-[#2a2a2a] text-zinc-300 rounded-xl transition border border-[#333]"
              title="Repetir Animação"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        ) : null}

        {/* Replay Controls Toolbar */}
        <div className="mt-4 flex items-center gap-2 w-full max-w-[340px] justify-center">
          <button
            onClick={handlePrev}
            className="p-2.5 bg-[#181818] hover:bg-[#222] text-zinc-300 rounded-xl border border-[#333] transition"
            title="Palavra Anterior"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition shadow-lg ${
              isPlaying
                ? 'bg-amber-400 text-black border border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                : 'bg-[#00FF00] text-black hover:bg-[#00e600] border border-[#00FF00] shadow-[0_0_20px_rgba(0,255,0,0.3)]'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause size={16} fill="black" /> Pausar Autoplay
              </>
            ) : (
              <>
                <Play size={16} fill="black" /> Tocar Todas
              </>
            )}
          </button>

          <button
            onClick={handleNext}
            className="p-2.5 bg-[#181818] hover:bg-[#222] text-zinc-300 rounded-xl border border-[#333] transition"
            title="Próxima Palavra"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      {/* Right Column: Words Selector & Filter List */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#222] mb-3">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition ${
              selectedFilter === 'all'
                ? 'bg-[#00FF00] text-black'
                : 'bg-[#181818] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Todas ({allWordRecords.length})
          </button>

          {currentUserId && (
            <button
              onClick={() => setSelectedFilter('mine')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition ${
                selectedFilter === 'mine'
                  ? 'bg-[#00FF00] text-black'
                  : 'bg-[#181818] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Minhas
            </button>
          )}

          {players.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedFilter(p.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition ${
                selectedFilter === p.name
                  ? 'bg-[#00FF00] text-black'
                  : 'bg-[#181818] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {p.name} ({(p.words || []).length})
            </button>
          ))}
        </div>

        {/* Word Grid / List */}
        <div className="flex-1 overflow-y-auto max-h-[360px] pr-1 space-y-1.5 custom-scrollbar">
          {filteredWords.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.word}
                onClick={() => handleSelectWord(idx)}
                className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between ${
                  isSelected
                    ? 'bg-[#1a2e1a] border-[#00FF00] text-white shadow-[0_0_15px_rgba(0,255,0,0.15)]'
                    : 'bg-[#161616] border-[#222] text-zinc-300 hover:bg-[#1f1f1f] hover:border-[#333]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <span className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center font-mono ${
                    isSelected ? 'bg-[#00FF00] text-black' : 'bg-[#222] text-zinc-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <span className="font-mono font-bold tracking-wider uppercase text-sm block">
                      {item.word}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block truncate">
                      {item.foundBy.join(', ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pl-2">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-md font-mono ${
                    isSelected ? 'bg-[#00FF00] text-black' : 'bg-[#222] text-zinc-400'
                  }`}>
                    +{item.score}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
