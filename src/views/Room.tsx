import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebase';
import { doc, collection, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { joinRoom, startGame, addWordToPlayer, saveFinalStats, resetPlayer, restartGame, suggestWord, updateRoomSettings, transferHost } from '../lib/room';
import { isAdjacent, validateWord, generateBoard, getScore } from '../lib/boggle';
import { Play, Loader2, Check, X, ArrowLeft, Trophy, Users, Clock, Crown, QrCode, MonitorPlay, Settings, Menu, Smile, BookOpen, Medal, Hourglass, User, Database, Share2, Sparkles, Volume2, VolumeX, Eye, Minus, Plus, Maximize, Minimize } from 'lucide-react';
import WordBankModal from '../components/WordBankModal';
import AnimatedTimer from '../components/AnimatedTimer';
import BoardReplay from '../components/BoardReplay';
import TvBoardReplay from '../components/TvBoardReplay';
import QRCode from 'react-qr-code';
import { fireWinnerConfetti, startVictoryLoop } from '../lib/confetti';
import { playSelectLetter, playWordSuccess, playWordError, playTimerTick, playGameOver, playVictorySound, isAudioMuted, toggleAudioMute } from '../lib/sounds';

export default function Room({ roomId, isTV, onLeave }: { roomId: string, isTV?: boolean, onLeave: () => void }) {
  const { user, profile, loading: authLoading } = useAuth();
  
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isWordBankOpen, setIsWordBankOpen] = useState(false);
  
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info'; word?: string } | null>(null);
  const [muted, setMuted] = useState(isAudioMuted());
  const [tvGameOverTab, setTvGameOverTab] = useState<'podium' | 'replay'>('replay');
  const [showTvReplay, setShowTvReplay] = useState(true);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!room) {
        setLoadTimedOut(true);
      }
    }, 10000); // Increased to 10s for slow connections
    return () => clearTimeout(timer);
  }, [room]);

  const boardRef = useRef<HTMLDivElement>(null);
  const lastTickRef = useRef<number>(-1);

  const handleToggleMute = () => {
    const next = toggleAudioMute();
    setMuted(next);
  };

  useEffect(() => {
    if (!user || isTV) return;
    joinRoom(roomId.toUpperCase(), user.uid, profile?.name || user.displayName || 'Jogador');
  }, [user, profile, roomId, isTV]);

  useEffect(() => {
    const rid = roomId.toUpperCase();
    const unsubRoom = onSnapshot(doc(db, 'rooms', rid), (docSnap) => {
      if (docSnap.exists()) {
        setRoom(docSnap.data());
        setError(null);
      } else {
        setError("Esta sala não existe mais ou foi encerrada.");
        setTimeout(() => onLeave(), 3000);
      }
    }, (err) => {
      console.error("Erro no listener da sala:", err);
      setError("Erro de conexão com o servidor. Verifique sua internet.");
    });

    const unsubPlayers = onSnapshot(query(collection(db, 'rooms', rid, 'players')), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    }, (err) => {
      console.warn("Players listener warning:", err);
    });

    return () => { unsubRoom(); unsubPlayers(); };
  }, [roomId, onLeave]);

  // Timer effect
  useEffect(() => {
    if (!room) return;
    if (room.status === 'playing') {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((room.endTime - Date.now()) / 1000));
        setTimeLeft(remaining);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [room?.status, room?.endTime]);

  // Dynamic Score Calculation
  const computedPlayers = useMemo(() => {
    const allWords = players.flatMap(p => (p.words || []).map((w: any) => typeof w === 'string' ? w : w?.word).filter(Boolean));
    const counts = allWords.reduce((acc: any, word: string) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
    
    return players.map(p => {
      let finalScore = 0;
      const scoredWords = (p.words || []).map((w: any) => {
        const wordStr = typeof w === 'string' ? w : w?.word;
        if (!wordStr) return null;
        const count = counts[wordStr] || 1;
        const baseScore = Math.max(1, wordStr.length - 2);
        const isExclusive = count === 1;
        const score = isExclusive ? baseScore * 2 : baseScore;
        
        finalScore += score;
        return { word: wordStr, score, count, baseScore, isExclusive };
      }).filter((w): w is any => w !== null).sort((a: any, b: any) => b.score - a.score);
      return { ...p, finalScore, scoredWords };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }, [players]);

  // Win condition and stats saving & sound celebrations
  useEffect(() => {
    if (room?.status === 'playing' && timeLeft === 0 && computedPlayers.length > 0) {
      playGameOver();
      const topPlayer = computedPlayers[0];
      if (topPlayer && topPlayer.finalScore > 0) {
        playVictorySound();
        const cleanup = startVictoryLoop(3500);
        return cleanup;
      }
    }
  }, [room?.status, timeLeft, computedPlayers]);

  // Audio timer tick sound during last seconds
  useEffect(() => {
    if (room?.status === 'playing' && timeLeft > 0) {
      if (timeLeft <= 10 && lastTickRef.current !== timeLeft) {
        lastTickRef.current = timeLeft;
        playTimerTick(true);
      }
    }
  }, [timeLeft, room?.status]);

  // Win condition and stats saving
  useEffect(() => {
    if (isTV) return;
    // Se o tempo acabou OU se o jogo acabou (status waiting mas com palavras), tenta salvar
    const isActuallyOver = (room?.status === 'playing' && timeLeft === 0) || 
                           (room?.status === 'waiting' && players.some(p => p.id === user?.uid && p.words?.length > 0));
    
    if (isActuallyOver && user && players.length > 0) {
      const myComputed = computedPlayers.find(p => p.id === user.uid);
      if (myComputed && !myComputed.statsSaved && (myComputed.words?.length > 0)) {
        // Calculate rank based on unique scores to handle ties
        const scores: number[] = computedPlayers.map(p => p.finalScore as number);
        const uniqueScores: number[] = Array.from(new Set(scores)).sort((a: number, b: number) => b - a);
        
        const myScore = myComputed.finalScore;
        const scoreIndex = uniqueScores.indexOf(myScore);
        
        // Rank is 1-based index of unique scores
        // If my score is 0, no trophies
        let rank = 0;
        if (myScore > 0 && scoreIndex !== -1 && scoreIndex < 3) {
          rank = scoreIndex + 1;
        }

        saveFinalStats(roomId, user.uid, myComputed.finalScore, myComputed.scoredWords.length, rank);
      }
    }
  }, [timeLeft, room?.status, user, computedPlayers, roomId, players.length]);

  // Reset players for new match
  useEffect(() => {
    if (isTV || !room || room.status !== 'waiting' || !user) return;
    
    const myPlayerInfo = players.find(p => p.id === user.uid);
    // Only reset if we actually have data that needs resetting
    if (myPlayerInfo && (myPlayerInfo.words?.length > 0 || myPlayerInfo.statsSaved === true)) {
       resetPlayer(roomId, user.uid, profile?.name || user.displayName || 'Jogador');
    }
  }, [room?.status, user?.uid, players, roomId, profile?.name]);

  const showMessage = (text: string, type: 'success' | 'error' | 'info', word?: string) => {
    setMessage({ text, type, word });
    setTimeout(() => setMessage(null), type === 'error' ? 4000 : 2000);
  };

  const handleStartGame = () => {
    startGame(roomId, room.duration || 180);
  };



  const gridRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastTouchTimeRef = useRef(0);
  const tileRectsRef = useRef<{index: number, rect: DOMRect, centerX: number, centerY: number}[]>([]);

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

  const getTileIndexFromCoords = (clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const tile = el.closest('[data-index]');
    if (!tile) return null;
    return parseInt(tile.getAttribute('data-index')!, 10);
  };

  const submitWordFromPath = async (pathToSubmit: number[]) => {
    if (pathToSubmit.length < (room?.minWordLength || 3) || room?.status !== 'playing' || isChecking) {
      return;
    }

    const word = pathToSubmit.map((idx) => room?.board?.[idx] || '').join('');
    const myPlayerInfo = players.find(p => p.id === user?.uid);
    
    if (myPlayerInfo?.words?.some((w: any) => (typeof w === 'string' ? w : w.word) === word)) {
      playWordError();
      showMessage('Palavra já encontrada!', 'info');
      setSelectedPath([]);
      return;
    }

    setIsChecking(true);
    const canonical = await validateWord(word, room?.minWordLength || 3);
    
    if (canonical && user) {
      const score = getScore(word);
      playWordSuccess(score);
      await addWordToPlayer(roomId, user.uid, canonical);
      showMessage(`Palavra adicionada! +${score} pts`, 'success');
    } else {
      playWordError();
      showMessage('Palavra não encontrada', 'error', word);
    }
    
    setIsChecking(false);
    setSelectedPath([]);
  };

  const startDrag = (index: number, e?: React.SyntheticEvent) => {
    if (room?.status !== 'playing' || isChecking) return;

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
    setIsDragging(true);

    setSelectedPath((prevPath) => {
      // If tapping last letter again
      if (prevPath.length > 0 && prevPath[prevPath.length - 1] === index) {
        if (prevPath.length >= (room?.minWordLength || 3)) {
          setTimeout(() => submitWordFromPath(prevPath), 0);
          return prevPath;
        } else {
          return []; // Clear if too short
        }
      }

      // If tapping second-to-last letter, backspace 1 letter
      if (prevPath.length >= 2 && prevPath[prevPath.length - 2] === index) {
        playSelectLetter(Math.max(0, prevPath.length - 2));
        return prevPath.slice(0, -1);
      }

      if (prevPath.includes(index)) return prevPath;

      if (prevPath.length === 0) {
        playSelectLetter(0);
        return [index];
      }

      const lastIndex = prevPath[prevPath.length - 1];
      if (isAdjacent(lastIndex, index, roomGridSize)) {
        playSelectLetter(prevPath.length);
        return [...prevPath, index];
      }

      // Tapping a non-adjacent tile starts a new selection
      playSelectLetter(0);
      return [index];
    });
  };

  const processDragMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current || room?.status !== 'playing' || isChecking) return;
    const index = getTileIndexFromCoords(clientX, clientY);
    if (index === null) return;

    setSelectedPath((prevPath) => {
      if (prevPath.length === 0) {
        playSelectLetter(0);
        return [index];
      }
      const lastIndex = prevPath[prevPath.length - 1];
      if (index === lastIndex) return prevPath;

      // Handle direct backspacing
      if (prevPath.length >= 2 && prevPath[prevPath.length - 2] === index) {
        playSelectLetter(Math.max(0, prevPath.length - 2));
        return prevPath.slice(0, -1);
      }

      // Step-by-step interpolation between lastIndex and target index
      const size = roomGridSize || 4;
      const startRow = Math.floor(lastIndex / size);
      const startCol = lastIndex % size;
      const targetRow = Math.floor(index / size);
      const targetCol = index % size;

      let currRow = startRow;
      let currCol = startCol;
      let newPath = [...prevPath];
      let changed = false;

      while (currRow !== targetRow || currCol !== targetCol) {
        const dr = Math.sign(targetRow - currRow);
        const dc = Math.sign(targetCol - currCol);
        currRow += dr;
        currCol += dc;
        const nextIdx = currRow * size + currCol;

        // Check if backspacing along path
        if (newPath.length >= 2 && newPath[newPath.length - 2] === nextIdx) {
          newPath = newPath.slice(0, -1);
          changed = true;
          continue;
        }

        // Cannot revisit a tile already in path
        if (newPath.includes(nextIdx)) {
          break;
        }

        newPath.push(nextIdx);
        changed = true;
      }

      if (changed) {
        playSelectLetter(newPath.length - 1);
        return newPath;
      }

      return prevPath;
    });
  };

  const endDrag = (e?: React.SyntheticEvent) => {
    if (!isDraggingRef.current) return;
    if (e && e.cancelable) e.preventDefault();
    isDraggingRef.current = false;
    setIsDragging(false);

    setSelectedPath((currentPath) => {
      if (currentPath.length >= (room?.minWordLength || 3)) {
        setTimeout(() => submitWordFromPath(currentPath), 0);
        return currentPath;
      }
      // If below minimum length, clear selection so the user can start a new word immediately
      return [];
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
  }, [room?.status, isChecking]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-[#141414] border border-[#222] p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30 mb-2">
            <X size={32} className="text-red-500" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-black mb-2 uppercase tracking-widest text-red-500">PROBLEMA NA SALA</h2>
          <p className="text-zinc-400 mb-4 font-bold uppercase tracking-wider text-sm">{error}</p>
          <button 
            onClick={onLeave}
            className="w-full bg-[#222] hover:bg-[#333] text-zinc-200 font-bold py-3 rounded-xl uppercase tracking-wider text-xs transition border border-[#333]"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  if (authLoading || (!room && !loadTimedOut)) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 text-center">
        <div className="relative mb-8">
           <div className="w-20 h-20 border-4 border-[#00FF00]/20 border-t-[#00FF00] rounded-full animate-spin"></div>
           <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#00FF00]" size={32} />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-2 animate-pulse">Entrando na Sala...</h2>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Sincronizando com o servidor LOUD</p>
        
        {/* Debug connection status */}
        <div className="mt-12 p-4 bg-[#111] rounded-2xl border border-[#222] max-w-xs w-full">
           <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest mb-2">Status da Conexão</p>
           <div className="flex items-center justify-between text-[10px] font-bold uppercase">
              <span className="text-zinc-500">Autenticação:</span>
              <span className={authLoading ? "text-amber-500" : "text-[#00FF00]"}>{authLoading ? "Verificando..." : "OK"}</span>
           </div>
           <div className="flex items-center justify-between text-[10px] font-bold uppercase mt-1">
              <span className="text-zinc-500">Sincronização Sala:</span>
              <span className={!room ? "text-amber-500" : "text-[#00FF00]"}>{!room ? "Aguardando..." : "OK"}</span>
           </div>
        </div>
      </div>
    );
  }

  if (!room && loadTimedOut) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-[#141414] border border-[#222] p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-4">
          <X size={40} className="text-red-500" />
          <h2 className="text-xl font-black uppercase tracking-wider text-zinc-100">Erro de Conexão</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Não conseguimos localizar a sala {roomId.toUpperCase()}. Verifique se o código está correto ou se a conexão caiu.
          </p>
          <div className="flex flex-col gap-2 w-full mt-2">
            <button 
              onClick={() => window.open(window.location.href, '_blank')} 
              className="w-full bg-[#00FF00] hover:bg-[#00dd00] text-black font-black py-3 rounded-xl uppercase tracking-wider text-xs transition"
            >
              Abrir em Nova Aba
            </button>
            <button 
              onClick={onLeave} 
              className="w-full bg-[#222] hover:bg-[#333] text-zinc-200 font-bold py-3 rounded-xl uppercase tracking-wider text-xs transition"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roomGridSize = room?.gridSize || 4;
  const currentWord = selectedPath.map((idx) => room?.board?.[idx] || '').join('');
  const isHost = room?.hostId === user?.uid;
  const isGameOver = room?.status === 'playing' && timeLeft === 0;
  const isPlaying = room?.status === 'playing' && timeLeft > 0;
  
  const joinUrl = `${window.location.origin}/?room=${roomId.toUpperCase()}`;
  const displayRoomId = roomId.toUpperCase();

  if (isTV) {
    const leftPlayers = computedPlayers.filter((_, i) => i % 2 === 0);
    const rightPlayers = computedPlayers.filter((_, i) => i % 2 !== 0);

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#d946ef] via-[#ec4899] to-[#f43f5e] text-zinc-100 font-sans flex flex-col items-center relative overflow-hidden p-8">
        
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-yellow-400/10 blur-[120px] rounded-full"></div>

        {/* Top Header with Timer and Info */}
        <div className="w-full flex justify-center items-start relative z-20 mb-8">
          <div className="flex flex-col items-center">
            {room.status === 'playing' ? (
              <AnimatedTimer
                timeLeft={timeLeft}
                totalDuration={room.duration || 180}
                size="tv"
                variant="pill"
              />
            ) : (
              <div className="bg-white/10 backdrop-blur-md px-8 py-4 rounded-full border border-white/20 shadow-2xl flex items-center gap-4">
                <Trophy className="text-yellow-400" size={32} />
                <span className="text-3xl font-black uppercase tracking-widest">
                  {room.status === 'waiting' ? 'Aguardando Jogadores' : 'Fim de Jogo'}
                </span>
              </div>
            )}
          </div>

          <div className="absolute right-0 top-0 flex flex-col items-end">
            <div className="bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10 flex items-center gap-3">
               <div className="bg-yellow-400 text-black p-2 rounded-lg font-black text-xl shadow-lg">
                 {room.gridSize}
               </div>
               <div className="text-right">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Modo de Jogo</p>
                 <p className="text-sm font-black uppercase tracking-wider">Grade {room.gridSize}x{room.gridSize}</p>
               </div>
            </div>
          </div>
        </div>

        {/* Main Gameplay Area */}
        <div className="flex-1 w-full flex justify-between items-center relative z-10 px-4">
          
          {/* Left Column Players */}
          <div className="flex flex-col gap-6 w-72">
            {leftPlayers.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-4 animate-in slide-in-from-left duration-500">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-[#2D164D] border-4 border-white/20 overflow-hidden shadow-xl flex items-center justify-center">
                    <User size={32} className="text-white/40" />
                  </div>
                  {p.isHost && (
                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-black p-1 rounded-full shadow-lg">
                      <Crown size={12} />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex flex-col">
                    <span className="text-lg font-black uppercase tracking-wider drop-shadow-md truncate max-w-[160px]">{p.name}</span>
                    <span className="text-sm font-bold text-white/80 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="text-xl text-yellow-400">{p.scoredWords?.length || 0}</span> palavras
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Centered Board */}
          <div className="relative group">
            {/* Glow effect behind board */}
            <div className="absolute inset-0 bg-white/5 blur-[60px] rounded-full scale-110"></div>
            
              <div 
                className="grid gap-3 md:gap-4 bg-[#2D164D] p-6 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border-4 border-white/10 aspect-square max-w-[600px] w-full relative z-10"
                style={{ gridTemplateColumns: `repeat(${roomGridSize}, minmax(0, 1fr))` }}
              >
                {(room?.board || []).map((letter: string, index: number) => {
                  const textSizeClass = roomGridSize === 4 ? 'text-6xl' : roomGridSize === 5 ? 'text-5xl' : roomGridSize === 6 ? 'text-4xl' : roomGridSize === 7 ? 'text-3xl' : 'text-2xl';
                  return (
                    <div 
                      key={index}
                      className={`flex items-center justify-center font-black uppercase rounded-[1.5rem] bg-white text-[#2D164D] shadow-[0_8px_0_0_rgba(0,0,0,0.2)] ${textSizeClass}`}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
          </div>

          {/* Right Column Players */}
          <div className="flex flex-col gap-6 w-72 items-end">
            {rightPlayers.slice(0, 3).map((p) => (
              <div key={p.id} className="flex items-center gap-4 text-right animate-in slide-in-from-right duration-500">
                <div>
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-black uppercase tracking-wider drop-shadow-md truncate max-w-[160px]">{p.name}</span>
                    <span className="text-sm font-bold text-white/80 uppercase tracking-widest flex items-center gap-1.5">
                      palavras <span className="text-xl text-yellow-400">{p.scoredWords?.length || 0}</span>
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-[#2D164D] border-4 border-white/20 overflow-hidden shadow-xl flex items-center justify-center">
                    <User size={32} className="text-white/40" />
                  </div>
                  {p.isHost && (
                    <div className="absolute -top-2 -left-2 bg-yellow-400 text-black p-1 rounded-full shadow-lg">
                      <Crown size={12} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Banner with QR Code */}
        <div className="w-full flex justify-end items-end p-4 relative z-20">
          <div className="flex flex-col items-end gap-3">
            <div className="bg-black/80 backdrop-blur-md p-4 rounded-[2rem] border border-white/20 flex items-center gap-4 shadow-2xl">
              <div className="text-right">
                <p className="text-sm font-black uppercase tracking-widest text-white leading-tight">Leia o QR code<br/>para jogar!</p>
              </div>
              <div className="bg-white p-2 rounded-2xl">
                <QRCode value={joinUrl} size={100} />
              </div>
            </div>
          </div>
        </div>

        {/* Game Over Modal / Results over the board if needed */}
        {isGameOver && (
          <TvBoardReplay 
            board={room.board || []} 
            gridSize={room.gridSize || 4} 
            players={players} 
          />
        )}
      </div>
    );
  }

  if (!isHost && !isTV && room.status === 'waiting') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] font-sans flex flex-col p-6 items-center relative overflow-y-auto overflow-x-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#00FF00]/10 blur-[80px] pointer-events-none rounded-full"></div>

        {/* Top Nav */}
        <div className="flex justify-between items-center w-full max-w-sm mb-6 mt-4 relative z-10">
          <button 
            onClick={handleToggleMute} 
            className="w-10 h-10 bg-[#141414] border border-[#222] rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-200"
            title={muted ? "Ativar Som" : "Silenciar Som"}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="w-12 h-12 bg-[#00FF00] rounded-full flex items-center justify-center text-black font-black text-2xl shadow-[0_0_15_rgba(0,255,0,0.3)]">L</div>
          <button onClick={onLeave} className="w-10 h-10 bg-[#141414] border border-[#222] rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-200"><X size={20} /></button>
        </div>

        {/* Profile Card */}
        <div className="w-full max-w-xs relative mb-6 z-10">
           <div className="absolute -top-6 -left-4 bg-[#00FF00] text-black p-3 rounded-2xl rotate-[-12deg] shadow-[0_0_20px_rgba(0,255,0,0.4)] z-10">
             <User size={32} />
           </div>
           <div className="bg-[#111111] rounded-[2rem] p-3 border-2 border-[#222222] shadow-[0_0_40px_rgba(0,0,0,0.8)] relative z-0">
             <div className="bg-[#1a1a1a] h-44 rounded-[1.5rem] flex items-center justify-center mb-3 border border-[#333]">
               <Smile size={96} className="text-zinc-700" strokeWidth={1.5} />
             </div>
             <div className="text-center py-1 pb-2">
               <h2 className="text-2xl font-black text-zinc-100 uppercase tracking-widest truncate">{profile?.name || user?.displayName || 'Jogador'}</h2>
               <p className="text-xs text-[#00FF00] font-bold uppercase tracking-wider mt-0.5">Sala: {roomId}</p>
             </div>
           </div>
        </div>

        {/* Real-time Synced Host Settings Pill Box */}
        <div className="w-full max-w-xs bg-[#111111] p-4 rounded-2xl border border-[#222] mb-6 relative z-10 shadow-xl">
          <p className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            <Settings size={13} className="text-[#00FF00]" /> Configurações da Rodada:
          </p>
          <div className="grid grid-cols-3 gap-2 text-center font-mono">
            <div className="bg-[#181818] p-2 rounded-xl border border-[#282828]">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Grade</span>
              <span className="text-sm font-black text-[#00FF00]">{room.gridSize || 4}x{room.gridSize || 4}</span>
            </div>
            <div className="bg-[#181818] p-2 rounded-xl border border-[#282828]">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Tempo</span>
              <span className="text-sm font-black text-zinc-100">{room.duration || 180}s</span>
            </div>
            <div className="bg-[#181818] p-2 rounded-xl border border-[#282828]">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">Mínimo</span>
              <span className="text-sm font-black text-zinc-100">{room.minWordLength || 3} ltr</span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-[#222] flex items-center justify-between text-xs text-zinc-400 font-bold uppercase">
            <span className="flex items-center gap-1"><Users size={14} className="text-[#00FF00]" /> {players.length} Jogadores</span>
            <span className="text-[#00FF00] animate-pulse font-mono font-black">● Sincronizado</span>
          </div>
        </div>

        {/* Waiting Status */}
        <div className="w-full max-w-xs bg-[#111111] p-5 rounded-[2rem] border border-[#222222] flex flex-col gap-4 relative z-10 shadow-2xl">
           <div className="flex items-center justify-center gap-4 p-2">
             <Hourglass className="text-[#00FF00] animate-[spin_4s_linear_infinite]" size={40} strokeWidth={1.5} />
             <p className="text-zinc-400 font-bold text-xs tracking-widest uppercase leading-tight">
               AGUARDANDO<br/><span className="text-[#00FF00]">O HOST</span><br/>INICIAR
             </p>
           </div>
        </div>

        <p className="mt-auto pt-6 text-zinc-600 text-[11px] font-bold uppercase tracking-widest text-center px-8">
          A partida começará na tela do host
        </p>
      </div>
    );
  }

  if (isGameOver) {
    const isWinner = computedPlayers[0]?.id === user?.uid && computedPlayers[0]?.finalScore > 0;
    
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-4 md:p-8">
         {/* Desktop / TV Layout */}
         <div className="max-w-6xl mx-auto hidden md:flex flex-col gap-6">
           <header className="bg-[#141414] p-6 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-[#222] flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-6">
               <div className="hidden md:block bg-white p-2 rounded-xl shadow-[0_0_15px_rgba(0,255,0,0.15)] border-2 border-[#00FF00]">
                 <QRCode value={joinUrl} size={70} />
               </div>
               <div>
                 <div className="flex items-center gap-2">
                   <h1 className="text-3xl font-black text-[#00FF00] uppercase tracking-widest drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]">Resultados Finais</h1>
                   <button 
                     onClick={() => fireWinnerConfetti()} 
                     className="p-2 bg-[#1a1a1a] hover:bg-[#222] text-[#00FF00] rounded-xl border border-[#00FF00]/30 transition transform active:scale-95 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,0,0.2)]"
                     title="Lançar Confetes"
                   >
                     <Sparkles size={16} /> Confetes
                   </button>
                   <button
                     onClick={handleToggleMute}
                     className="p-2 bg-[#1a1a1a] hover:bg-[#222] text-zinc-400 hover:text-zinc-200 rounded-xl border border-[#333] transition"
                     title={muted ? "Ativar Som" : "Silenciar Som"}
                   >
                     {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                   </button>
                 </div>
                 <p className="text-zinc-400 font-bold tracking-widest text-xs uppercase mt-1">Veja a trajetória de cada palavra encontrada no tabuleiro!</p>
               </div>
             </div>
             <div className="flex flex-wrap gap-4 w-full md:w-auto mt-4 md:mt-0">
               <button 
                 onClick={() => setShowTvReplay(true)}
                 className="flex-1 md:flex-none px-6 py-3 bg-[#4c1d95] text-white font-black rounded-xl hover:bg-[#5b21b6] transition flex items-center justify-center gap-2 uppercase tracking-wider shadow-[0_0_15px_rgba(109,40,217,0.4)]"
               >
                 <Trophy size={20} /> Animação do Pódio
               </button>
               <button onClick={onLeave} className="flex-1 md:flex-none px-6 py-3 bg-[#111] text-zinc-300 border border-[#333] font-bold rounded-xl hover:bg-[#222] transition text-center uppercase tracking-wider text-sm">
                 Sair da Sala
               </button>
               {isHost ? (
                 <button onClick={() => restartGame(roomId, room?.gridSize || 4)} className="w-full md:w-auto px-6 py-3 bg-[#00FF00] text-black font-black rounded-xl hover:bg-[#00e600] transition flex items-center justify-center gap-2 uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                   <Play size={20} /> Jogar Novamente
                 </button>
               ) : (
                 <div className="w-full md:w-auto px-6 py-3 bg-[#1a1a1a] text-zinc-500 font-bold rounded-xl border border-[#333] flex items-center justify-center text-center uppercase tracking-wider text-xs">
                   Aguardando o Anfitrião...
                 </div>
               )}
             </div>
           </header>

           {showTvReplay && (
             <TvBoardReplay 
               board={room.board || []} 
               gridSize={room.gridSize || 4} 
               players={players} 
               onClose={() => setShowTvReplay(false)}
             />
           )}

           {isWinner && (
             <div className="bg-gradient-to-r from-[#00FF00]/10 via-[#00FF00]/20 to-[#00FF00]/10 border-2 border-[#00FF00] p-4 rounded-2xl flex items-center justify-between shadow-[0_0_30px_rgba(0,255,0,0.25)] animate-in fade-in zoom-in">
               <div className="flex items-center gap-3">
                 <div className="p-3 bg-[#00FF00] text-black rounded-xl shadow-[0_0_15px_rgba(0,255,0,0.5)]">
                   <Crown size={28} />
                 </div>
                 <div>
                   <h2 className="text-xl font-black text-white uppercase tracking-widest">🏆 Vitória Extraordinária!</h2>
                   <p className="text-xs text-[#00FF00] font-bold uppercase tracking-wider">Você conquistou o 1º lugar nesta rodada!</p>
                 </div>
               </div>
               <button 
                 onClick={() => fireWinnerConfetti()} 
                 className="px-4 py-2 bg-[#00FF00] text-black font-black rounded-xl text-xs uppercase tracking-widest hover:bg-[#00e600] transition flex items-center gap-1.5 shadow-md"
               >
                 <Sparkles size={16} /> Comemorar
               </button>
             </div>
           )}

           {/* Interactive Board Replay with Speed Controls & Letter Path Tracing */}
           <BoardReplay 
             board={room.board || []} 
             gridSize={room.gridSize || 4}
             minWordLength={room.minWordLength || 3}
             players={players}
             currentUserId={user?.uid}
           />
           
           {/* Detailed Players Ranking */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {computedPlayers.map((p, index) => {
               const pWinner = index === 0 && p.finalScore > 0;
               return (
                 <div key={p.id} className={`bg-[#111] p-6 rounded-3xl shadow-[0_0_20px_rgba(0,0,0,0.5)] border ${pWinner ? 'border-[#00FF00] shadow-[0_0_30px_rgba(0,255,0,0.15)]' : 'border-[#222]'} flex flex-col`}>
                   <div className="flex items-center gap-4 mb-6">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl ${pWinner ? 'bg-[#00FF00] text-black shadow-[0_0_15px_rgba(0,255,0,0.4)]' : 'bg-[#1a1a1a] text-zinc-500 border border-[#333]'}`}>
                        {pWinner ? <Crown size={24} /> : index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-black text-lg text-zinc-100 uppercase tracking-widest leading-tight flex items-center gap-2">{p.name} {p.id === user?.uid && <span className="text-[10px] bg-[#00FF00]/20 text-[#00FF00] px-2 py-1 rounded-full font-black border border-[#00FF00]/30">VOCÊ</span>}</h3>
                        <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">{p.scoredWords.length} palavras</p>
                      </div>
                      <div className="text-4xl font-black text-[#00FF00] text-right drop-shadow-[0_0_10px_rgba(0,255,0,0.2)]">
                        {p.finalScore} <span className="text-sm text-zinc-600 font-bold uppercase tracking-widest">pts</span>
                      </div>
                   </div>
                   <div className="flex-1 space-y-2 overflow-y-auto pr-2 max-h-[300px] custom-scrollbar">
                     {p.scoredWords.map((w: any, i: number) => (
                       <div key={i} className="flex justify-between items-center p-3 bg-[#1a1a1a] rounded-xl border border-[#222]">
                         <span className="font-black text-zinc-100 uppercase tracking-widest">{w.word || w}</span>
                         <div className="flex items-center gap-2">
                           {w.count > 1 ? (
                             <span className="text-[10px] font-black text-zinc-500 bg-[#111] px-2 py-1 rounded border border-[#333] uppercase tracking-widest">Empate ({w.score})</span>
                           ) : (
                             <span className="text-[10px] font-black text-[#00FF00] bg-[#00FF00]/10 px-2 py-1 rounded border border-[#00FF00]/30 uppercase tracking-widest">Exclusiva x2 ({w.score})</span>
                           )}
                         </div>
                       </div>
                     ))}
                     {p.scoredWords.length === 0 && (
                       <p className="text-center text-zinc-600 py-8 font-bold uppercase tracking-widest text-sm">Nenhuma palavra encontrada.</p>
                     )}
                   </div>
                 </div>
               );
             })}
           </div>
         </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden flex-col items-center justify-center min-h-[80vh] gap-8">
         <div className="bg-[#141414] p-8 rounded-3xl border border-[#222] shadow-[0_0_40px_rgba(0,0,0,0.8)] w-full max-w-sm flex flex-col items-center text-center">
           <Trophy size={48} className={isWinner ? "text-[#00FF00] mb-4" : "text-zinc-500 mb-4"} />
           <h2 className="text-3xl font-black text-[#00FF00] uppercase tracking-widest drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]">Fim de Jogo</h2>
           <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-2">
              Olhe para a tela principal para ver os resultados
           </p>
           
           <div className="mt-8 w-full">
            {isHost ? (
              <button onClick={() => restartGame(roomId, room?.gridSize || 4)} className="w-full px-6 py-4 bg-[#00FF00] text-black font-black rounded-2xl hover:bg-[#00e600] transition flex items-center justify-center gap-2 uppercase tracking-wider shadow-[0_0_20px_rgba(0,255,0,0.3)]">
                <Play size={20} /> Jogar Novamente
              </button>
            ) : (
              <div className="w-full px-6 py-4 bg-[#1a1a1a] text-zinc-500 font-bold rounded-2xl border border-[#333] flex items-center justify-center text-center uppercase tracking-wider text-xs">
                Aguardando o Anfitrião...
              </div>
            )}
            <button onClick={onLeave} className="w-full mt-4 px-6 py-3 bg-transparent text-zinc-500 font-bold rounded-xl transition text-center uppercase tracking-wider text-xs border border-[#333]">
              Sair da Sala
            </button>
           </div>
         </div>
      </div>
    </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-2 sm:p-4 selection:bg-transparent overflow-x-hidden ${isFakeFullscreen ? 'fixed inset-0 z-[100] overflow-y-auto w-full h-full' : ''}`}>
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 items-start">
        
        {/* Lado Esquerdo - Tabuleiro e Controles */}
        <div className="flex-1 w-full max-w-md mx-auto">
          <header className="mb-4 flex flex-wrap gap-2 justify-between items-center bg-[#141414] p-3 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-[#222]">
            <div className="overflow-hidden flex items-center gap-3">
              <button onClick={onLeave} className="p-2 bg-[#1a1a1a] text-zinc-500 hover:text-zinc-300 transition rounded-xl border border-[#333]">
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 leading-none mb-1">SALA ONLINE</p>
                <h1 className="text-xl font-black tracking-widest text-[#00FF00] flex items-center gap-2 uppercase truncate leading-none">
                  {displayRoomId}
                </h1>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
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
              
              {isPlaying && (
                <div className="flex items-center">
                  <AnimatedTimer
                    timeLeft={timeLeft}
                    totalDuration={room.duration || 180}
                    size="md"
                    variant="pill"
                  />
                </div>
              )}
            </div>
          </header>

          {room.status === 'waiting' && (
            <div className="bg-[#141414] rounded-2xl flex flex-col p-4 border border-[#222] shadow-[0_0_40px_rgba(0,0,0,0.8)] mb-4">
              
              {/* QR Section - Compact */}
              <div className="flex flex-col items-center mb-4">
                <div className="w-full bg-[#111] p-3 rounded-2xl border border-[#222] mb-3 flex flex-col items-center">
                  <div className="bg-white p-2 rounded-xl mb-3 shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                    <QRCode value={joinUrl} size={90} viewBox={`0 0 256 256`} />
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full">
                     <button 
                       onClick={() => {
                         navigator.clipboard.writeText(joinUrl);
                         showMessage('Link copiado!', 'success');
                       }}
                       className="flex-1 py-2 px-2 bg-[#1a1a1a] text-zinc-300 rounded-xl font-black text-[10px] uppercase tracking-wider border border-[#333] flex items-center justify-center gap-1.5"
                     >
                       <Share2 size={14} /> Link
                     </button>
                     <button 
                       onClick={() => window.open(`/?room=${roomId.toUpperCase()}&tv=true`, '_blank')}
                       className="flex-1 py-2 px-2 bg-[#1a1a1a] text-[#00FF00] rounded-xl font-black text-[10px] uppercase tracking-wider border border-[#00FF00]/20 flex items-center justify-center gap-1.5"
                     >
                       <MonitorPlay size={14} /> TV
                     </button>
                  </div>
                </div>
              </div>

              {/* Players List in Lobby - Higher Position */}
              <div className="bg-[#111] p-3 rounded-2xl border border-[#222] mb-4">
                 <div className="flex items-center justify-between mb-2">
                   <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                     <Users size={14} className="text-[#00FF00]" /> Jogadores ({players.length})
                   </h3>
                   <span className="text-[9px] bg-[#00FF00]/10 text-[#00FF00] px-2 py-0.5 rounded-full font-black border border-[#00FF00]/20">ONLINE</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {players.length === 0 ? (
                     <p className="text-[10px] text-zinc-600 font-bold uppercase py-2">Nenhum jogador na sala...</p>
                   ) : (
                     players.map(p => {
                       const isMe = p.id === user?.uid;
                       const isPlayerHost = room?.hostId === p.id;
                       return (
                         <div key={p.id} className="bg-[#1a1a1a] px-3 py-1.5 rounded-lg border border-[#333] flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-[#00FF00] animate-pulse"></div>
                           <span className={`text-[11px] font-black uppercase truncate max-w-[80px] ${isMe ? 'text-[#00FF00]' : 'text-zinc-300'}`}>
                             {p.name} {isMe && '(VOCÊ)'}
                           </span>
                           {isPlayerHost ? (
                             <Crown size={10} className="text-yellow-500" />
                           ) : (
                             isHost && !isTV && (
                               <button 
                                 onClick={() => transferHost(roomId, p.id)}
                                 className="ml-1 text-[8px] font-black bg-[#222] text-zinc-400 border border-[#333] px-1.5 py-0.5 rounded hover:bg-[#00FF00] hover:text-black hover:border-[#00FF00] transition-all uppercase tracking-tighter"
                                 title="Tornar Anfitrião"
                               >
                                 HOST
                               </button>
                             )
                           )}
                         </div>
                       );
                     })
                   )}
                 </div>
              </div>

              {isHost ? (
                <div className="flex flex-col gap-3 mb-4">
                  <div className="bg-[#111] p-3 rounded-2xl border border-[#222] space-y-4">
                    {/* Grid Size */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Tamanho da Grade</label>
                      <div className="flex flex-wrap justify-center gap-1">
                        {[4, 5, 6, 7, 8].map(size => (
                          <button 
                            key={size}
                            onClick={() => updateRoomSettings(roomId, { gridSize: size, board: generateBoard(size) })}
                            className={`py-2 px-3 rounded-lg font-black text-[10px] transition-all border ${room.gridSize === size ? 'bg-[#00FF00] text-black border-[#00FF00]' : 'bg-[#0a0a0a] text-zinc-500 border-[#222]'}`}
                          >
                            {size}x{size}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration & Min Letters - Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Tempo</label>
                        <select 
                          value={room.duration}
                          onChange={(e) => updateRoomSettings(roomId, { duration: parseInt(e.target.value) })}
                          className="bg-[#0a0a0a] text-zinc-300 p-2 rounded-xl border border-[#222] font-black text-xs text-center outline-none focus:border-[#00FF00] w-full"
                        >
                          {[60, 90, 120, 180, 240, 300].map(time => (
                            <option key={time} value={time}>{time}s</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Mínimo Letras</label>
                        <div className="flex items-center justify-between bg-[#0a0a0a] p-1 rounded-xl border border-[#222] w-full">
                          <button 
                            onClick={() => updateRoomSettings(roomId, { minWordLength: Math.max(3, (room.minWordLength || 3) - 1) })}
                            className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#00FF00]"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-black text-white px-2">{room.minWordLength || 3}</span>
                          <button 
                            onClick={() => updateRoomSettings(roomId, { minWordLength: Math.min(8, (room.minWordLength || 3) + 1) })}
                            className="w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#00FF00]"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <button onClick={handleStartGame} className="w-full bg-[#00FF00] text-black py-4 rounded-2xl font-black text-lg shadow-[0_0_25px_rgba(0,255,0,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-[0.2em]">
                      <Play size={24} fill="currentColor" /> JOGAR
                    </button>
                    <button 
                      onClick={() => setIsWordBankOpen(true)}
                      className="w-full py-2 bg-[#1a1a1a] text-zinc-400 rounded-xl font-bold uppercase tracking-wider text-[10px] border border-[#333] transition"
                    >
                      Banco de Palavras
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#111] border border-[#222] p-4 rounded-2xl mb-4 flex flex-col items-center gap-3">
                   <div className="flex items-center gap-3 text-lg font-black text-zinc-100">
                      <Clock size={20} className="text-[#00FF00]" /> 
                      <span>{room.duration}s</span>
                      <span className="text-zinc-700">•</span>
                      <span>{room.gridSize}x{room.gridSize}</span>
                   </div>
                   <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Aguardando o Host...</p>
                   <button 
                      onClick={() => setIsWordBankOpen(true)}
                      className="py-2 px-4 bg-[#1a1a1a] text-zinc-400 rounded-xl font-bold uppercase tracking-wider text-[10px] border border-[#333] transition"
                    >
                      Ver Banco de Palavras
                    </button>
                </div>
              )}
            </div>
          )}

          {room.status !== 'waiting' && (
            <>
            <div 
              className={`p-3 rounded-3xl select-none touch-none mb-4 relative overflow-hidden transition-all duration-1000 ${
                room.status === 'playing' 
                  ? 'bg-[#1a1a1a] shadow-[0_0_60px_rgba(0,255,0,0.15)] border border-[#00FF00]/40' 
                  : 'bg-[#141414] shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-[#222]'
              }`}
              style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
            >
              {/* Grid do Board */}
            <div 
              ref={gridRef}
              className="grid gap-2 md:gap-3 aspect-square"
              style={{ gridTemplateColumns: `repeat(${roomGridSize}, minmax(0, 1fr))` }}
            >
              {(room?.board || []).map((letter: string, index: number) => {
                const isSelected = selectedPath.includes(index);
                const isLast = selectedPath[selectedPath.length - 1] === index;
                const textSizeClass = roomGridSize === 4 ? 'text-3xl md:text-4xl' : roomGridSize === 5 ? 'text-2xl md:text-3xl' : roomGridSize === 6 ? 'text-xl md:text-2xl' : roomGridSize === 7 ? 'text-lg md:text-xl' : 'text-sm md:text-base';
                
                return (
                  <div 
                    key={index}
                    data-index={index}
                    onTouchStart={(e) => startDrag(index, e)}
                    onPointerDown={(e) => startDrag(index, e)}
                    onMouseDown={(e) => startDrag(index, e)}
                    style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                    className={`
                      flex items-center justify-center font-black uppercase rounded-2xl md:rounded-[1.5rem] transition-all duration-150 cursor-pointer touch-none select-none ${textSizeClass}
                      ${isSelected 
                        ? 'bg-[#00FF00] text-black shadow-[0_4px_0_0_#00cc00] translate-y-0.5' 
                        : 'bg-[#2D164D] text-white hover:bg-[#3d1e66] shadow-[0_6px_0_0_#1a0d2d] active:translate-y-1 active:shadow-[0_2px_0_0_#1a0d2d] border border-[#4a247f]/30'
                      }
                      ${isLast ? 'ring-4 ring-white/30' : ''}
                    `}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-20 flex flex-col items-center justify-center bg-[#141414] rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-[#222] py-2 relative">
             <div className="absolute top-1 right-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">
               Mínimo: {room?.minWordLength || 3} Letras
             </div>
             {isPlaying && (
                <div className="text-center w-full px-3">
                  <div className={`text-2xl sm:text-3xl font-black tracking-widest ${isChecking ? 'text-zinc-500' : 'text-[#00FF00] drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]'} flex items-center justify-center gap-1 sm:gap-2 h-8 uppercase`}>
                    {currentWord || <div className="flex gap-1 text-[#333] tracking-[0.2em]">{Array.from({ length: room?.minWordLength || 3 }).map((_, i) => <span key={i}>_</span>)}</div>}
                    {isChecking && <Loader2 size={24} className="animate-spin text-zinc-500 ml-2" />}
                  </div>
                  
                  {selectedPath.length > 0 && !isChecking && (
                    <div className="flex items-center gap-1.5 ml-2">
                      {/* Auto-submit e tap-to-clear nativo removes need for buttons */}
                    </div>
                  )}

                  <div className="h-6 mt-1 flex items-center justify-center">
                    {message && (
                      <div className={`text-xs font-black flex items-center gap-2 uppercase tracking-widest
                        ${message.type === 'success' ? 'text-[#00FF00]' : ''}
                        ${message.type === 'error' ? 'text-red-500' : ''}
                        ${message.type === 'info' ? 'text-zinc-400' : ''}
                      `}>
                        {message.type === 'success' && <Check size={16} strokeWidth={3} />}
                        {message.type === 'error' && <X size={16} strokeWidth={3} />}
                        {message.text}
                        {message.type === 'error' && message.word && user && (
                          <button 
                            onClick={() => {
                              suggestWord(message.word!, user.uid);
                              showMessage('Enviada!', 'success');
                            }}
                            className="ml-2 bg-red-900/30 text-red-400 border border-red-500/30 px-2 py-0.5 rounded hover:bg-red-900/50 pointer-events-auto transition"
                          >
                            SUGERIR
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
             )}
          </div>
          </>
        )}
        </div>

        {/* Lado Direito - Placar e Jogadores */}
        <div className="flex-1 w-full bg-[#141414] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-[#222] flex flex-col h-[400px] lg:h-[600px] overflow-hidden">
          <div className="p-4 border-b border-[#222] flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Users size={16} className="text-[#00FF00]" /> Ranking da Rodada
            </h2>
            <span className="text-[10px] bg-[#00FF00]/10 text-[#00FF00] px-2 py-1 rounded-full font-black border border-[#00FF00]/20 uppercase">
              {players.length} online
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="space-y-3">
              {computedPlayers.map((p, index) => (
                <div key={p.id} className={`p-3 rounded-2xl border transition-all ${p.id === user?.uid ? 'bg-[#00FF00]/5 border-[#00FF00]/20' : 'bg-[#1a1a1a] border-[#222]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${index === 0 && p.finalScore > 0 ? 'bg-yellow-400 text-black' : 'bg-[#111] text-zinc-500'}`}>
                        {index === 0 && p.finalScore > 0 ? <Crown size={14} /> : index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase tracking-wider text-zinc-100 flex items-center gap-2">
                          {p.name} {p.id === user?.uid && <span className="text-[9px] bg-[#00FF00]/20 text-[#00FF00] px-1.5 py-0.5 rounded font-black">VOCÊ</span>}
                        </p>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{p.scoredWords.length} palavras</p>
                      </div>
                    </div>
                    <div className="text-xl font-black text-[#00FF00] font-mono">
                      {p.finalScore}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <WordBankModal
        isOpen={isWordBankOpen}
        onClose={() => setIsWordBankOpen(false)}
      />
    </div>
  );
}
