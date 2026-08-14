import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';
import { db } from '../lib/firebase';
import { doc, collection, onSnapshot, query, updateDoc } from 'firebase/firestore';
import { joinRoom, startGame, addWordToPlayer, saveFinalStats, resetPlayer, restartGame, suggestWord, updateRoomSettings, transferHost } from '../lib/room';
import { isAdjacent, validateWord, generateBoard } from '../lib/boggle';
import { Play, Loader2, Check, X, ArrowLeft, Trophy, Users, Clock, Crown, QrCode, MonitorPlay, Settings, Menu, Smile, BookOpen, Medal, Hourglass, User, Database } from 'lucide-react';
import QRCode from 'react-qr-code';
import WordBankModal from '../components/WordBankModal';

export default function Room({ roomId, isTV, onLeave }: { roomId: string, isTV?: boolean, onLeave: () => void }) {
  const { user, profile } = useAuth();
  
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isWordBankOpen, setIsWordBankOpen] = useState(false);
  
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info'; word?: string } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !profile || isTV) return;
    joinRoom(roomId, user.uid, profile.name);
  }, [user, profile, roomId, isTV]);

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
      if (docSnap.exists()) {
        setRoom(docSnap.data());
      } else {
        onLeave();
      }
    });

    const unsubPlayers = onSnapshot(query(collection(db, 'rooms', roomId, 'players')), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
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
    const allWords = players.flatMap(p => p.words?.map((w: any) => w.word) || []);
    const counts = allWords.reduce((acc: any, word: string) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
    
    return players.map(p => {
      let finalScore = 0;
      const scoredWords = (p.words || []).map((w: any) => {
        const count = counts[w.word] || 1;
        const baseScore = Math.max(1, w.word.length - 2);
        const isExclusive = count === 1;
        const score = isExclusive ? baseScore * 2 : baseScore;
        
        finalScore += score;
        return { word: w.word, score, count, baseScore, isExclusive };
      }).sort((a: any, b: any) => b.score - a.score);
      return { ...p, finalScore, scoredWords };
    }).sort((a, b) => b.finalScore - a.finalScore);
  }, [players]);

  // Win condition and stats saving
  useEffect(() => {
    if (isTV) return;
    if (room?.status === 'playing' && timeLeft === 0 && user && players.length > 0) {
      const myComputed = computedPlayers.find(p => p.id === user.uid);
      if (myComputed && !myComputed.statsSaved) {
        const isWinner = computedPlayers[0]?.id === user.uid && myComputed.finalScore > 0;
        saveFinalStats(roomId, user.uid, myComputed.finalScore, myComputed.scoredWords.length, isWinner);
      }
    }
  }, [timeLeft, room?.status, user, computedPlayers, roomId, players.length]);

  // Reset players for new match
  useEffect(() => {
    if (isTV) return;
    if (room?.status === 'waiting' && user) {
      const myPlayerInfo = players.find(p => p.id === user.uid);
      if (myPlayerInfo && (myPlayerInfo.words?.length > 0 || myPlayerInfo.statsSaved)) {
         resetPlayer(roomId, user.uid, profile?.name || 'Jogador');
      }
    }
  }, [room?.status, user, players, roomId, profile?.name]);

  const showMessage = (text: string, type: 'success' | 'error' | 'info', word?: string) => {
    setMessage({ text, type, word });
    setTimeout(() => setMessage(null), type === 'error' ? 4000 : 2000);
  };

  const handleStartGame = () => {
    startGame(roomId, room.duration || 180);
  };

  const handleCellEnter = (index: number) => {
    if (!isDragging || room?.status !== 'playing' || isChecking) return;
    setSelectedPath((prevPath) => {
      if (prevPath.length >= 2 && prevPath[prevPath.length - 2] === index) return prevPath.slice(0, -1);
      if (prevPath.includes(index)) return prevPath;
      if (prevPath.length === 0) return [index];
      const lastIndex = prevPath[prevPath.length - 1];
      if (isAdjacent(lastIndex, index, room.gridSize)) return [...prevPath, index];
      return prevPath;
    });
  };

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    if (room?.status !== 'playing' || isChecking) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(true);
    setSelectedPath([index]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || room?.status !== 'playing') return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el) {
      const indexStr = el.getAttribute('data-index');
      if (indexStr !== null) {
        handleCellEnter(parseInt(indexStr, 10));
      }
    }
  };

  const handlePointerUp = async () => {
    if (!isDragging || room?.status !== 'playing') return;
    setIsDragging(false);

    if (selectedPath.length < room.minWordLength) {
      setSelectedPath([]);
      if (selectedPath.length > 0) showMessage(`Mínimo ${room.minWordLength} letras`, 'info');
      return;
    }

    const word = selectedPath.map((idx) => room.board[idx]).join('');
    const myPlayerInfo = players.find(p => p.id === user?.uid);
    
    if (myPlayerInfo?.words?.some((w: any) => w.word === word)) {
      showMessage('Palavra já encontrada!', 'info');
      setSelectedPath([]);
      return;
    }

    setIsChecking(true);
    const isValid = await validateWord(word);
    
    if (isValid && user) {
      await addWordToPlayer(roomId, user.uid, word);
      showMessage(`Palavra adicionada!`, 'success');
    } else {
      showMessage('Palavra não encontrada', 'error', word);
    }
    
    setIsChecking(false);
    setSelectedPath([]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!room) return <div className="min-h-screen flex items-center justify-center">Entrando na sala...</div>;

  const currentWord = selectedPath.map((idx) => room.board[idx]).join('');
  const isHost = room.hostId === user?.uid;
  const isGameOver = room.status === 'playing' && timeLeft === 0;
  const isPlaying = room.status === 'playing' && timeLeft > 0;
  
  const joinUrl = `${window.location.origin}/?room=${roomId}`;

  if (isTV) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans flex flex-col items-center relative overflow-hidden">
        
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00FF00]/5 blur-[120px] pointer-events-none rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#00FF00]/5 blur-[120px] pointer-events-none rounded-full"></div>

        {/* Header */}
        <div className="w-full flex justify-between items-center p-8 relative z-10">
          <div className="flex flex-col items-start">
            <h1 className="text-4xl md:text-5xl font-black text-[#00FF00] tracking-widest drop-shadow-[0_0_15px_rgba(0,255,0,0.3)]">LOUD</h1>
            <h2 className="text-xl font-black tracking-[0.35em] uppercase text-zinc-100">BOOGLE</h2>
          </div>
          <div className="flex gap-4 items-center bg-[#111111] p-4 rounded-3xl border border-[#222222] shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="bg-white p-2 rounded-xl">
              <QRCode value={joinUrl} size={90} />
            </div>
            <div>
              <p className="text-lg font-black text-zinc-100 uppercase tracking-widest">Leia o QR code</p>
              <p className="text-zinc-500 font-bold uppercase tracking-wider text-sm">para jogar!</p>
            </div>
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 w-full max-w-7xl flex flex-col justify-center items-center -mt-10 px-8 relative z-10">
          {room.status === 'waiting' && (
            <div className="text-center animate-in fade-in zoom-in duration-500">
              <div className="bg-white p-6 rounded-3xl inline-block mb-8 shadow-[0_0_50px_rgba(0,255,0,0.15)] border-4 border-[#00FF00]">
                <QRCode value={joinUrl} size={240} />
              </div>
              <h2 className="text-5xl font-black mb-4 uppercase tracking-wider text-zinc-100 drop-shadow-md">Aguardando Anfitrião...</h2>
              <p className="text-2xl text-[#00FF00] flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-sm"><Users size={32} /> {players.length} jogadores conectados</p>
            </div>
          )}

          {isPlaying && (
            <div className="flex flex-row gap-20 items-center w-full justify-center">
              {/* Board */}
              <div 
                className="grid gap-3 md:gap-4 bg-[#141414] p-8 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-[#222] aspect-square max-w-[650px] w-full"
                style={{ gridTemplateColumns: `repeat(${room.gridSize}, minmax(0, 1fr))` }}
              >
                {(room.board || []).map((letter: string, index: number) => {
                  const textSizeClass = room.gridSize === 4 ? 'text-5xl md:text-6xl' : room.gridSize === 5 ? 'text-4xl md:text-5xl' : room.gridSize === 6 ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl';
                  return (
                    <div 
                      key={index}
                      className={`flex items-center justify-center font-black uppercase rounded-2xl bg-[#0a0a0a] text-zinc-100 border border-[#333] shadow-[0_0_15px_rgba(0,0,0,0.5)] ${textSizeClass}`}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>

              {/* Timer & Info */}
              <div className="flex flex-col items-center bg-[#111111] p-12 rounded-3xl border border-[#222] shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                <div className="flex items-center gap-4 text-zinc-500 mb-6">
                  <Clock size={48} className="text-[#00FF00]" />
                  <span className="text-4xl font-black uppercase tracking-widest">Tempo</span>
                </div>
                <div className={`text-[9rem] leading-none font-black font-mono tabular-nums drop-shadow-[0_0_30px_rgba(0,255,0,0.2)] ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-[#00FF00]'}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>
          )}

          {isGameOver && (
            <div className="w-full text-center animate-in slide-in-from-bottom-8 fade-in duration-700">
              <h2 className="text-7xl font-black mb-16 text-[#00FF00] drop-shadow-[0_0_30px_rgba(0,255,0,0.3)] uppercase tracking-widest">Tempo Esgotado!</h2>
              <div className="flex gap-8 justify-center items-end h-[400px]">
                {computedPlayers.slice(0, 5).map((p, i) => (
                  <div key={p.id} className="flex flex-col items-center animate-in slide-in-from-bottom fade-in duration-500" style={{ animationDelay: `${i * 150}ms`, animationFillMode: 'both' }}>
                    <div className="bg-[#111] px-6 py-3 rounded-2xl mb-6 border border-[#222] shadow-xl">
                      <div className="text-3xl font-black text-zinc-100 uppercase tracking-wider truncate max-w-[200px]">{p.name}</div>
                      <div className="text-[#00FF00] font-bold text-lg mt-1 tracking-widest text-sm uppercase">{p.scoredWords.length} palavras</div>
                    </div>
                    <div className={`w-48 rounded-t-3xl flex flex-col items-center justify-start pt-8 border-x border-t shadow-[0_0_40px_rgba(0,0,0,0.8)] relative
                      ${i === 0 ? 'bg-[#1a1a1a] h-80 border-[#00FF00]/50 text-[#00FF00] z-10' 
                      : i === 1 ? 'bg-[#141414] h-64 border-zinc-700 text-zinc-300' 
                      : 'bg-[#141414] h-48 border-orange-900/50 text-orange-500'}`}>
                      {i === 0 && <Crown size={64} className="absolute -top-24 text-[#00FF00] drop-shadow-[0_0_20px_rgba(0,255,0,0.4)]" />}
                      <span className="text-7xl font-black drop-shadow-md">{p.finalScore}</span>
                      <span className="text-2xl font-bold opacity-80 mt-2 tracking-widest">PTS</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Players */}
        {room.status === 'playing' && (
          <div className="w-full h-48 bg-[#111] border-t border-[#222] p-6 flex gap-6 overflow-x-auto items-center relative z-20">
            {computedPlayers.map((p, index) => (
              <div key={p.id} className="min-w-[240px] h-full bg-[#1a1a1a] rounded-3xl p-5 text-center border border-[#333] flex flex-col justify-center shadow-lg relative overflow-hidden">
                <div className="absolute top-2 left-3 text-zinc-800 font-black text-5xl italic">#{index + 1}</div>
                <div className="font-black text-2xl uppercase tracking-wider truncate text-zinc-100 relative z-10">{p.name}</div>
                <div className="text-5xl font-black text-[#00FF00] my-2 relative z-10 drop-shadow-[0_0_10px_rgba(0,255,0,0.2)]">{p.finalScore}</div>
                <div className="text-zinc-500 font-bold uppercase tracking-widest text-sm relative z-10">{p.scoredWords.length} palavras</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!isHost && !isTV && room.status === 'waiting') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] font-sans flex flex-col p-6 items-center relative overflow-hidden">
        
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#00FF00]/10 blur-[80px] pointer-events-none rounded-full"></div>

        {/* Top Nav */}
        <div className="flex justify-between items-center w-full max-w-sm mb-12 mt-4 relative z-10">
          <button className="w-10 h-10 bg-[#141414] border border-[#222] rounded-full flex items-center justify-center text-zinc-400"><Settings size={20} /></button>
          <div className="w-12 h-12 bg-[#00FF00] rounded-full flex items-center justify-center text-black font-black text-2xl shadow-[0_0_15px_rgba(0,255,0,0.3)]">L</div>
          <button onClick={onLeave} className="w-10 h-10 bg-[#141414] border border-[#222] rounded-full flex items-center justify-center text-zinc-400"><X size={20} /></button>
        </div>

        {/* Profile Card */}
        <div className="w-full max-w-xs relative mb-12 z-10">
           <div className="absolute -top-6 -left-4 bg-[#00FF00] text-black p-3 rounded-2xl rotate-[-12deg] shadow-[0_0_20px_rgba(0,255,0,0.4)] z-10">
             <User size={32} />
           </div>
           <div className="bg-[#111111] rounded-[2rem] p-3 border-2 border-[#222222] shadow-[0_0_40px_rgba(0,0,0,0.8)] relative z-0">
             <div className="bg-[#1a1a1a] h-56 rounded-[1.5rem] flex items-center justify-center mb-3 border border-[#333]">
               <Smile size={120} className="text-zinc-700" strokeWidth={1.5} />
             </div>
             <div className="text-center py-2 pb-3">
               <h2 className="text-3xl font-black text-zinc-100 uppercase tracking-widest">{profile?.name || user?.displayName || 'Jogador'}</h2>
             </div>
           </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full max-w-xs bg-[#111111] p-5 rounded-[2.5rem] border border-[#222222] flex flex-col gap-4 relative z-10 shadow-2xl">
           <button className="w-full bg-[#1a1a1a] text-zinc-300 border border-[#333] font-bold uppercase tracking-widest text-sm py-4 px-6 rounded-2xl flex items-center gap-4 hover:bg-[#222] transition-all">
             <div className="bg-[#0a0a0a] p-2 rounded-xl border border-[#333]">
               <BookOpen className="text-[#00FF00]" size={24} />
             </div>
             Como Jogar
           </button>
           
           <div className="mt-4 flex items-center justify-center gap-4 p-2 pb-4">
             <Hourglass className="text-[#00FF00] animate-[spin_4s_linear_infinite]" size={48} strokeWidth={1.5} />
             <p className="text-zinc-400 font-bold text-sm tracking-widest uppercase leading-tight">
               AGUARDANDO<br/><span className="text-[#00FF00]">O HOST</span><br/>INICIAR
             </p>
           </div>
        </div>

        <p className="mt-auto pt-8 text-zinc-600 text-xs font-bold uppercase tracking-widest text-center px-8">
          A partida começará na tela do host
        </p>
      </div>
    );
  }

  if (isGameOver) {
    const isWinner = computedPlayers[0]?.id === user?.uid && computedPlayers[0]?.finalScore > 0;
    
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-4 md:p-8">
         <div className="max-w-6xl mx-auto flex flex-col gap-6">
           <header className="bg-[#141414] p-6 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-[#222] flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-6">
               <div className="hidden md:block bg-white p-2 rounded-xl shadow-[0_0_15px_rgba(0,255,0,0.15)] border-2 border-[#00FF00]">
                 <QRCode value={joinUrl} size={80} />
               </div>
               <div>
                 <h1 className="text-3xl font-black text-[#00FF00] uppercase tracking-widest drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]">Resultados Finais</h1>
                 <p className="text-zinc-400 font-bold tracking-widest text-sm uppercase">Escaneie o QR Code para a próxima partida!</p>
               </div>
             </div>
             <div className="flex gap-4 w-full md:w-auto">
               <button onClick={onLeave} className="flex-1 md:flex-none px-6 py-3 bg-[#111] text-zinc-300 border border-[#333] font-bold rounded-xl hover:bg-[#222] transition text-center uppercase tracking-wider text-sm">
                 Sair da Sala
               </button>
               {isHost && (
                 <button onClick={() => restartGame(roomId, room.gridSize)} className="flex-1 md:flex-none px-6 py-3 bg-[#00FF00] text-black font-black rounded-xl hover:bg-[#00e600] transition flex items-center justify-center gap-2 uppercase tracking-wider shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                   <Play size={20} /> Jogar Novamente
                 </button>
               )}
             </div>
           </header>
           
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
                   <div className="flex-1 space-y-2 overflow-y-auto pr-2 max-h-[500px]">
                     {p.scoredWords.map((w: any, i: number) => (
                       <div key={i} className="flex justify-between items-center p-3 bg-[#1a1a1a] rounded-xl border border-[#222]">
                         <span className="font-black text-zinc-100 uppercase tracking-widest">{w.word}</span>
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-4 md:p-8 selection:bg-transparent">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Lado Esquerdo - Tabuleiro e Controles */}
        <div className="flex-1 w-full max-w-md mx-auto">
          <header className="mb-6 flex justify-between items-center bg-[#141414] p-4 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-[#222]">
            <div>
              <button onClick={onLeave} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition text-sm font-bold uppercase mb-1 tracking-widest">
                <ArrowLeft size={16} /> Sair
              </button>
              <h1 className="text-xl font-black tracking-widest text-zinc-100 flex items-center gap-2 uppercase">
                Sala <span className="font-mono bg-[#1a1a1a] px-2 py-1 rounded text-[#00FF00] border border-[#333] shadow-[0_0_10px_rgba(0,255,0,0.1)]">{roomId}</span>
              </h1>
            </div>
            
            <div className="flex gap-4 items-center">
              <button onClick={() => window.open(`/?room=${roomId}&tv=true`, '_blank')} className="hidden md:flex items-center gap-2 bg-[#1a1a1a] text-[#00FF00] px-3 py-1.5 rounded-lg font-bold hover:bg-[#222] transition text-sm border border-[#00FF00]/30 shadow-[0_0_10px_rgba(0,255,0,0.1)] uppercase tracking-wider">
                <MonitorPlay size={16} /> Tela TV
              </button>
              
              {isPlaying && (
                <div className="text-right">
                  <div className={`text-3xl font-black font-mono flex items-center gap-2 ${timeLeft <= 30 ? 'text-red-500 animate-pulse drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'text-[#00FF00] drop-shadow-[0_0_15px_rgba(0,255,0,0.3)]'}`}>
                    <Clock size={24} /> {formatTime(timeLeft)}
                  </div>
                </div>
              )}
            </div>
          </header>

          <div 
            ref={boardRef}
            className="bg-[#141414] p-4 md:p-5 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-[#222] select-none touch-none mb-6 relative overflow-hidden"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {room.status === 'waiting' && (
              <div className="absolute inset-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-3 rounded-2xl border-4 border-[#00FF00] shadow-[0_0_30px_rgba(0,255,0,0.2)] mb-4">
                  <QRCode value={joinUrl} size={120} />
                </div>
                <h2 className="text-2xl font-black mb-1 uppercase tracking-widest text-zinc-100">Aguardando</h2>
                <p className="text-[#00FF00] mb-4 font-bold text-sm tracking-wider uppercase">Leia o QR code</p>
                
                {isHost ? (
                  <div className="w-full flex gap-2 justify-center mb-6">
                    <select 
                      value={room.gridSize} 
                      onChange={(e) => {
                        const size = Number(e.target.value);
                        updateRoomSettings(roomId, { gridSize: size, board: generateBoard(size) });
                      }} 
                      className="bg-[#1a1a1a] border border-[#333] px-3 py-2 rounded-lg font-black text-zinc-100 outline-none hover:bg-[#222] cursor-pointer uppercase tracking-widest text-sm"
                    >
                      <option value={4}>4x4</option>
                      <option value={5}>5x5</option>
                      <option value={6}>6x6</option>
                      <option value={7}>7x7</option>
                      <option value={8}>8x8</option>
                    </select>
                    <select 
                      value={room.duration} 
                      onChange={(e) => updateRoomSettings(roomId, { duration: Number(e.target.value) })} 
                      className="bg-[#1a1a1a] border border-[#333] px-3 py-2 rounded-lg font-black text-zinc-100 outline-none hover:bg-[#222] cursor-pointer uppercase tracking-widest text-sm"
                    >
                      <option value={60}>60s</option>
                      <option value={120}>120s</option>
                      <option value={180}>180s</option>
                    </select>
                  </div>
                ) : (
                  <div className="bg-[#1a1a1a] border border-[#333] px-4 py-2 rounded-lg font-bold text-zinc-300 mb-6 flex items-center gap-2 uppercase tracking-widest text-sm">
                     <Clock size={16} className="text-[#00FF00]" /> {room.duration}s
                  </div>
                )}
                
                {isHost ? (
                  <div className="w-full flex flex-col gap-3">
                    <button onClick={handleStartGame} className="w-full bg-[#00FF00] text-black px-8 py-4 rounded-xl font-black text-lg shadow-[0_0_20px_rgba(0,255,0,0.2)] hover:bg-[#00e600] transition-all flex items-center justify-center gap-2 uppercase tracking-widest">
                      <Play size={24} fill="currentColor" /> START
                    </button>
                    <button 
                      onClick={() => setIsWordBankOpen(true)}
                      className="w-full py-2.5 bg-[#1a1a1a] hover:bg-[#222] text-[#00FF00] rounded-xl font-bold uppercase tracking-wider text-xs border border-[#00FF00]/30 transition flex items-center justify-center gap-2"
                    >
                      <Database size={15} /> Banco de Palavras
                    </button>
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-3 items-center">
                    <div className="bg-[#111] text-zinc-500 px-8 py-3 rounded-xl font-bold border border-[#222] uppercase tracking-widest text-sm w-full text-center">
                      Aguardando...
                    </div>
                    <button 
                      onClick={() => setIsWordBankOpen(true)}
                      className="py-2 px-4 bg-[#1a1a1a] hover:bg-[#222] text-zinc-400 hover:text-zinc-200 rounded-xl font-bold uppercase tracking-wider text-xs border border-[#333] transition flex items-center gap-2"
                    >
                      <BookOpen size={14} /> Ver Banco de Palavras
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Grid do Board */}
            <div 
              className="grid gap-2 md:gap-3 aspect-square"
              style={{ gridTemplateColumns: `repeat(${room.gridSize}, minmax(0, 1fr))` }}
            >
              {(room.board || []).map((letter: string, index: number) => {
                const isSelected = selectedPath.includes(index);
                const isLast = selectedPath[selectedPath.length - 1] === index;
                const textSizeClass = room.gridSize === 4 ? 'text-3xl md:text-4xl' : room.gridSize === 5 ? 'text-2xl md:text-3xl' : room.gridSize === 6 ? 'text-xl md:text-2xl' : 'text-lg md:text-xl';
                
                return (
                  <div 
                    key={index}
                    data-index={index}
                    onPointerDown={(e) => handlePointerDown(index, e)}
                    className={`
                      flex items-center justify-center font-black uppercase rounded-xl transition-all duration-150 cursor-pointer touch-none ${textSizeClass}
                      ${isSelected 
                        ? 'bg-[#00FF00] text-black shadow-[0_4px_0_0_#00cc00] translate-y-0.5' 
                        : 'bg-[#1a1a1a] text-zinc-100 hover:bg-[#222] shadow-[0_6px_0_0_#000] active:translate-y-1 active:shadow-[0_2px_0_0_#000] border border-[#333]'
                      }
                      ${isLast ? 'ring-4 ring-white/50' : ''}
                    `}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-20 flex items-center justify-center bg-[#141414] rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-[#222]">
             {isPlaying && (
               <div className="text-center w-full">
                 <div className={`text-3xl font-black tracking-widest ${isChecking ? 'text-zinc-500' : 'text-[#00FF00] drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]'} flex items-center justify-center gap-3 h-10 uppercase`}>
                   {currentWord || <span className="text-[#333]">___</span>}
                   {isChecking && <Loader2 size={24} className="animate-spin text-zinc-500" />}
                 </div>
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
        </div>

        {/* Lado Direito - Placar e Jogadores */}
        <div className="flex-1 w-full bg-[#141414] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-[#222] flex flex-col h-[750px] overflow-hidden">
          
          <div className="p-6 border-b border-[#222] bg-[#111]">
            <h3 className="text-sm font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2">
              <Users size={18} className="text-[#00FF00]" /> Jogadores
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0a]">
            {computedPlayers.map((p, index) => {
              const isMe = p.id === user?.uid;
              const isWinner = isGameOver && index === 0 && p.finalScore > 0;
              return (
                <div key={p.id} className={`bg-[#111] rounded-2xl p-4 shadow-lg border ${isMe ? 'border-[#00FF00] shadow-[0_0_15px_rgba(0,255,0,0.1)]' : 'border-[#222]'} transition-all`}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${isWinner ? 'bg-[#00FF00] text-black' : 'bg-[#1a1a1a] text-zinc-500 border border-[#333]'}`}>
                        {isWinner ? <Crown size={20} /> : index + 1}
                      </div>
                      <div>
                        <h4 className="font-black text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
                          {p.name} 
                          {isMe && <span className="text-[10px] bg-[#00FF00]/20 text-[#00FF00] border border-[#00FF00]/30 px-2 py-0.5 rounded-full font-black">VOCÊ</span>}
                          {room.hostId === p.id && <Crown size={14} className="text-[#00FF00]" />}
                        </h4>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{p.scoredWords.length || 0} palavras</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isHost && !isMe && room.status === 'waiting' && (
                        <button 
                          onClick={() => transferHost(roomId, p.id)}
                          className="text-[10px] font-black bg-[#222] text-zinc-300 border border-[#333] px-2 py-1 rounded hover:bg-[#333] transition uppercase tracking-widest"
                        >
                          Dar Host
                        </button>
                      )}
                      <div className="text-2xl font-black text-[#00FF00] drop-shadow-[0_0_10px_rgba(0,255,0,0.2)]">
                        {p.finalScore} <span className="text-xs text-zinc-600 font-bold uppercase tracking-widest">pts</span>
                      </div>
                    </div>
                  </div>
                  
                  {p.scoredWords && p.scoredWords.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-[#222]">
                      {p.scoredWords.map((w: any, i: number) => (
                        <div key={i} className={`px-2 py-1 rounded text-[10px] font-black border flex items-center gap-1 uppercase tracking-widest ${w.count > 1 ? 'bg-[#1a1a1a] border-[#333] text-zinc-500' : 'bg-[#00FF00]/10 border-[#00FF00]/30 text-[#00FF00]'}`}>
                          {w.word} <span className={w.count > 1 ? 'text-zinc-600' : 'text-[#00cc00]'}>{w.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

      </div>

      <WordBankModal
        isOpen={isWordBankOpen}
        onClose={() => setIsWordBankOpen(false)}
        userId={user?.uid}
        userName={profile?.name}
      />
    </div>
  );
}

