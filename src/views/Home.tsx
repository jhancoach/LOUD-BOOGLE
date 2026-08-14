import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { loginWithGoogle, logout, db } from '../lib/firebase';
import { createRoom } from '../lib/room';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Trophy, Users, Play, LogOut, Medal, Star, Clock, QrCode, Gamepad2, X, Edit2, Database, BookOpen, MonitorPlay, ExternalLink, User as UserIcon, Minus, Plus } from 'lucide-react';
import WordBankModal from '../components/WordBankModal';

export default function Home({ onJoinRoom, onStartOffline }: { onJoinRoom: (id: string) => void, onStartOffline?: (settings: { gridSize: number, duration: number, minWordLength: number }) => void }) {
  const { user, profile, loading, loginAsGuest } = useAuth();
  const [roomIdInput, setRoomIdInput] = useState('');
  const [gridSize, setGridSize] = useState(4);
  const [minWordLength, setMinWordLength] = useState(3);
  const [duration, setDuration] = useState(180);
  const [guestNameInput, setGuestNameInput] = useState('');
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isWordBankOpen, setIsWordBankOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');

  const [topWinners, setTopWinners] = useState<any[]>([]);
  const [topWords, setTopWords] = useState<any[]>([]);
  const [topScore, setTopScore] = useState<any[]>([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditPhoto(profile.photoURL || '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', user.uid), {
        name: editName,
        photoURL: editPhoto
      });
      setIsEditingProfile(false);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const qWins = query(collection(db, 'users'), orderBy('wins', 'desc'), limit(5));
    const unsubWins = onSnapshot(qWins, (snap) => {
      setTopWinners(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }, (err) => {
      console.warn("Leaderboard wins listener warning:", err);
    });
    
    const qWords = query(collection(db, 'users'), orderBy('wordsFound', 'desc'), limit(5));
    const unsubWords = onSnapshot(qWords, (snap) => {
      setTopWords(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }, (err) => {
      console.warn("Leaderboard words listener warning:", err);
    });

    const qScore = query(collection(db, 'users'), orderBy('totalScore', 'desc'), limit(5));
    const unsubScore = onSnapshot(qScore, (snap) => {
      setTopScore(snap.docs.map(d => ({id: d.id, ...d.data()})));
    }, (err) => {
      console.warn("Leaderboard score listener warning:", err);
    });
    
    return () => { unsubWins(); unsubWords(); unsubScore(); };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

  const handleScan = (text: string) => {
    try {
      const url = new URL(text);
      const roomParam = url.searchParams.get('room');
      if (roomParam) {
        setIsScannerOpen(false);
        onJoinRoom(roomParam);
      }
    } catch {
      if (text.length > 3) {
        setIsScannerOpen(false);
        onJoinRoom(text);
      }
    }
  };

  if (isScannerOpen) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans flex flex-col relative overflow-hidden">
        
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-[#00FF00]/10 blur-[80px] pointer-events-none rounded-full"></div>

        <div className="p-6 flex justify-between items-center z-10">
          <div className="flex flex-col items-center mx-auto mt-4">
            <h1 className="text-3xl font-black text-[#00FF00] tracking-widest uppercase drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]">LOUD</h1>
            <h2 className="text-sm font-bold tracking-[0.3em] uppercase text-zinc-500">Games</h2>
          </div>
          <button onClick={() => setIsScannerOpen(false)} className="absolute top-8 right-6 p-2 bg-[#141414] border border-[#222] rounded-full hover:bg-[#222] transition text-zinc-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto w-full z-10 -mt-10">
           <div className="relative mb-10 w-32 h-32 flex items-center justify-center bg-[#00FF00] rounded-3xl shadow-[0_0_40px_rgba(0,255,0,0.3)] rotate-12">
             <div className="absolute inset-1 bg-[#1a1a1a] rounded-[1.3rem] flex items-center justify-center border border-[#333]">
               <Gamepad2 size={64} className="text-[#00FF00] -rotate-12 drop-shadow-[0_0_10px_rgba(0,255,0,0.3)]" strokeWidth={1.5} />
             </div>
           </div>

           <p className="text-lg mb-6 leading-relaxed font-bold uppercase tracking-widest text-zinc-300">
             Para usar o controle, inicie um jogo na TV e escaneie o código QR na tela.
           </p>
           
           <p className="text-zinc-600 text-xs font-black uppercase tracking-widest mb-12">
             Disponível na TV ou no computador.
           </p>

           <div className="w-full max-w-xs mx-auto space-y-4">
             <div className="w-full aspect-square rounded-3xl overflow-hidden mb-8 border-4 border-[#00FF00] shadow-[0_0_30px_rgba(0,255,0,0.15)] relative bg-black">
               <div className="flex flex-col items-center justify-center h-full p-6">
                  <QrCode size={48} className="text-[#00FF00] mb-4 opacity-20" />
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest text-center">Scanner desativado</p>
                </div>
               <div className="absolute inset-0 border-[6px] border-[#0a0a0a]/50 rounded-3xl pointer-events-none"></div>
             </div>
           </div>
        </div>
        
        <div className="mt-auto p-6 text-center text-zinc-600 text-[10px] font-black tracking-widest uppercase">
          A LOUD Games está em fase beta.
        </div>
      </div>
    );
  }

  const handleCreateRoom = async () => {
    try {
      setIsCreatingRoom(true);
      let activeUser = user;
      if (!activeUser) {
        activeUser = loginAsGuest(guestNameInput);
      }
      const id = await createRoom(activeUser.uid, gridSize, minWordLength, duration);
      onJoinRoom(id);
    } catch (error: any) {
      console.error("Erro ao criar sala:", error);
      alert("Não foi possível criar a sala. Verifique sua conexão com o Firebase.");
      setIsCreatingRoom(false);
    }
  };

  const handleStartTraining = () => {
    if (!user) {
      loginAsGuest(guestNameInput);
    }
    if (onStartOffline) {
      onStartOffline({ gridSize, duration, minWordLength });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-2 sm:p-4 md:p-8 flex flex-col justify-center items-center">
      <div className="max-w-6xl w-full mx-auto flex flex-col items-center">
        
        {/* Actions Card */}
        <div className="w-full max-w-lg flex flex-col items-center justify-center bg-[#141414] p-6 sm:p-8 md:p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-[#222222] relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00FF00]/5 blur-[100px] pointer-events-none rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00FF00]/5 blur-[100px] pointer-events-none rounded-full"></div>

          <div className="flex flex-col items-center mb-6 md:mb-8 relative z-10 w-full">
            <div className="flex justify-between items-start w-full mb-4">
              <div className="invisible"><Trophy size={20}/></div>
              <div className="flex flex-col items-center">
                <h1 className="text-4xl sm:text-5xl font-black text-[#00FF00] tracking-widest uppercase mb-1 drop-shadow-[0_0_15px_rgba(0,255,0,0.3)]">LOUD</h1>
                <h2 className="text-lg sm:text-xl font-black tracking-[0.35em] uppercase text-zinc-100 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">BOOGLE</h2>
              </div>
              <button 
                onClick={() => setIsLeaderboardOpen(true)}
                className="p-3 bg-[#1a1a1a] border border-[#222] rounded-2xl text-[#00FF00] hover:bg-[#222] transition shadow-lg flex items-center gap-2 group"
                title="Ver Placar de Líderes"
              >
                <Trophy size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block group-hover:block">Leaderboard</span>
              </button>
            </div>
          </div>

          <div className="w-full space-y-5 relative z-10">
            {/* User Profile or Guest Quick Setup */}
            {!user ? (
              <div className="bg-[#0a0a0a] p-3 md:p-4 rounded-2xl border border-[#222] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Identificação do Jogador</span>
                  <button onClick={() => setIsWordBankOpen(true)} className="text-[9px] md:text-[10px] font-black text-[#00FF00] hover:underline flex items-center gap-1 uppercase">
                    <BookOpen size={12} /> Dicionário
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <UserIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Seu Apelido"
                      value={guestNameInput}
                      onChange={(e) => setGuestNameInput(e.target.value)}
                      maxLength={15}
                      className="w-full bg-[#141414] border border-[#333] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#00FF00]"
                    />
                  </div>
                  <button 
                    onClick={() => loginAsGuest(guestNameInput)}
                    className="bg-[#00FF00] text-black px-4 py-2.5 rounded-xl font-black hover:bg-[#00e600] transition tracking-wide uppercase text-xs shadow-[0_0_15px_rgba(0,255,0,0.2)] whitespace-nowrap"
                  >
                    Salvar
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={loginWithGoogle} className="flex-1 bg-white text-black px-3 py-2.5 rounded-xl font-bold hover:bg-zinc-200 transition text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    Google
                  </button>
                  <button onClick={() => window.open(window.location.href, '_blank')} className="bg-[#222] border border-[#333] text-zinc-300 px-3 py-2.5 rounded-xl font-bold hover:bg-[#2a2a2a] transition text-[10px] sm:text-xs flex items-center justify-center gap-1">
                    <ExternalLink size={14} className="text-[#00FF00]" /> Nova Aba
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col bg-[#0a0a0a] p-3 md:p-4 rounded-xl border border-[#222] gap-2.5 md:gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Meu Perfil</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setIsWordBankOpen(true)} className="p-1.5 md:p-2 text-zinc-500 hover:text-[#00FF00] hover:bg-[#1a1a1a] transition rounded-lg" title="Banco de Palavras">
                      <Database size={14} className="md:w-4 md:h-4" />
                    </button>
                    <button onClick={() => setIsEditingProfile(true)} className="p-1.5 md:p-2 text-zinc-500 hover:text-[#00FF00] hover:bg-[#1a1a1a] transition rounded-lg" title="Editar Perfil">
                      <Edit2 size={14} className="md:w-4 md:h-4" />
                    </button>
                    <button onClick={logout} className="p-1.5 md:p-2 text-zinc-500 hover:text-red-500 hover:bg-[#1a1a1a] transition rounded-lg" title="Sair">
                      <LogOut size={14} className="md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-[#00FF00] rounded-full flex items-center justify-center text-black font-black text-lg md:text-xl uppercase shadow-[0_0_20px_rgba(0,255,0,0.3)] border-2 border-black/10">
                    {(profile?.name?.[0] || user?.displayName?.[0] || user?.uid?.[0] || '?')}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h2 className="font-black text-zinc-100 text-sm md:text-base uppercase tracking-wider truncate">{profile?.name || 'Jogador'}</h2>
                    <div className="flex items-center gap-2 md:gap-3 mt-0.5">
                      <div className="flex items-center gap-0.5 md:gap-1 text-yellow-500" title="Troféus de Ouro">
                        <Trophy size={12} className="md:w-3.5 md:h-3.5" />
                        <span className="text-[10px] md:text-xs font-black">{profile?.goldTrophies || 0}</span>
                      </div>
                      <div className="flex items-center gap-0.5 md:gap-1 text-zinc-300" title="Troféus de Prata">
                        <Trophy size={12} className="md:w-3.5 md:h-3.5" />
                        <span className="text-[10px] md:text-xs font-black">{profile?.silverTrophies || 0}</span>
                      </div>
                      <div className="flex items-center gap-0.5 md:gap-1 text-orange-500" title="Troféus de Bronze">
                        <Trophy size={12} className="md:w-3.5 md:h-3.5" />
                        <span className="text-[10px] md:text-xs font-black">{profile?.bronzeTrophies || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {profile?.longestWordFound && (
                  <div className="bg-[#141414] p-2 md:p-3 rounded-xl border border-[#222] flex items-center justify-between">
                    <span className="text-[8px] md:text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Maior:</span>
                    <span className="text-[10px] md:text-xs font-black text-[#00FF00] tracking-widest uppercase font-mono truncate ml-2">{profile.longestWordFound}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-1.5 md:gap-2 pt-2 border-t border-[#1a1a1a]">
                  <div className="bg-[#141414] p-1 md:p-1.5 rounded-lg text-center border border-[#222]">
                    <span className="text-[8px] md:text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Words</span>
                    <span className="text-[10px] md:text-xs font-black text-zinc-200">{profile?.wordsFound || 0}</span>
                  </div>
                  <div className="bg-[#141414] p-1 md:p-1.5 rounded-lg text-center border border-[#222]">
                    <span className="text-[8px] md:text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Games</span>
                    <span className="text-[10px] md:text-xs font-black text-zinc-200">{profile?.gamesPlayed || 0}</span>
                  </div>
                  <div className="bg-[#141414] p-1 md:p-1.5 rounded-lg text-center border border-[#222]">
                    <span className="text-[8px] md:text-[9px] text-zinc-500 font-bold uppercase tracking-wider block">Record</span>
                    <span className="text-[10px] md:text-xs font-black text-[#00FF00]">{profile?.highestSingleGameScore || profile?.totalScore || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Room Configuration / Mode Selection */}
            <div className="bg-[#141414] p-4 md:p-6 rounded-[2rem] border border-[#222] shadow-2xl space-y-6">
              <h3 className="font-black text-zinc-100 flex items-center justify-center gap-2 uppercase tracking-widest text-xs mb-2">
                <Play size={16} className="text-[#00FF00]" /> Configuração da Sala
              </h3>
              
              <div className="space-y-6">
                {/* Tamanho da Grade */}
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black tracking-widest text-zinc-500 uppercase text-center">Tamanho da Grade</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[4, 5, 6, 7, 8].map(size => (
                      <button 
                        key={size} 
                        onClick={() => setGridSize(size)} 
                        className={`flex flex-col items-center gap-2 p-2 rounded-2xl transition-all border-2 ${gridSize === size ? 'bg-[#00FF00]/10 border-[#00FF00] shadow-[0_0_15px_rgba(0,255,0,0.2)]' : 'bg-[#0a0a0a] border-[#222] hover:border-[#333]'}`}
                      >
                        <div className={`grid gap-0.5 ${size === 4 ? 'grid-cols-4' : size === 5 ? 'grid-cols-5' : size === 6 ? 'grid-cols-6' : size === 7 ? 'grid-cols-7' : 'grid-cols-8'}`}>
                          {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className={`w-0.5 h-0.5 rounded-full ${gridSize === size ? 'bg-[#00FF00]' : 'bg-zinc-700'}`} />
                          ))}
                        </div>
                        <span className={`text-[9px] font-black ${gridSize === size ? 'text-[#00FF00]' : 'text-zinc-500'}`}>{size}x{size}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Duração */}
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black tracking-widest text-zinc-500 uppercase text-center">Duração da Partida</label>
                  <div className="flex bg-[#0a0a0a] p-1 rounded-2xl border border-[#222]">
                    {[60, 120, 180, 240, 300].map(time => (
                      <button 
                        key={time} 
                        onClick={() => setDuration(time)} 
                        className={`flex-1 py-2 rounded-xl font-black text-[10px] transition-all ${duration === time ? 'bg-[#00FF00] text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {time}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mínimo de Letras */}
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] font-black tracking-widest text-zinc-500 uppercase text-center">Mínimo de Letras</label>
                  <div className="flex items-center justify-between bg-[#0a0a0a] p-2 rounded-2xl border border-[#222] max-w-[200px] mx-auto w-full">
                    <button 
                      onClick={() => setMinWordLength(Math.max(3, minWordLength - 1))}
                      className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[#00FF00] hover:bg-[#222] transition active:scale-95"
                    >
                      <Minus size={20} strokeWidth={3} />
                    </button>
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black text-white">{minWordLength}</span>
                      <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter">LETRAS</span>
                    </div>
                    <button 
                      onClick={() => setMinWordLength(Math.min(8, minWordLength + 1))}
                      className="w-10 h-10 rounded-xl bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-[#00FF00] hover:bg-[#222] transition active:scale-95"
                    >
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button 
                  disabled={isCreatingRoom} 
                  onClick={handleCreateRoom} 
                  className="w-full bg-[#00FF00] text-black h-14 rounded-[1.5rem] font-black uppercase tracking-widest text-sm hover:bg-[#00e600] transition-all shadow-[0_10px_20px_rgba(0,255,0,0.2)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreatingRoom ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : 'Criar Sala Online'}
                </button>
                
                <button 
                  onClick={handleStartTraining} 
                  className="w-full bg-transparent border-2 border-[#333] text-zinc-400 h-12 rounded-[1.2rem] font-black uppercase tracking-widest text-[10px] hover:border-[#444] hover:text-zinc-200 transition-all active:scale-[0.98]"
                >
                  Modo Treino Solo
                </button>
              </div>
            </div>

            <div className="border-t border-[#222] pt-4">
              <h3 className="font-bold text-zinc-100 mb-3 flex items-center gap-2 uppercase tracking-widest text-[10px] md:text-xs"><Users size={16} className="text-[#00FF00]" /> Entrar em Sala</h3>
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="ID DA SALA" 
                    className="flex-1 bg-[#0a0a0a] border border-[#333] text-zinc-100 px-4 py-3 rounded-xl focus:outline-none focus:border-[#00FF00] transition font-mono font-bold uppercase placeholder-zinc-700 text-center tracking-widest text-xs h-11"
                    value={roomIdInput}
                    onChange={e => setRoomIdInput(e.target.value)}
                  />
                  <button 
                    disabled={!roomIdInput.trim()}
                    onClick={() => {
                      if (!user) loginAsGuest(guestNameInput);
                      onJoinRoom(roomIdInput.trim().toUpperCase());
                    }} 
                    className="bg-[#222] text-zinc-100 px-4 sm:px-6 py-3 rounded-xl font-bold hover:bg-[#333] transition uppercase tracking-wider text-[11px] disabled:opacity-50"
                  >
                    Entrar
                  </button>
                </div>
                
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="w-full bg-[#111] text-[#00FF00] px-4 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-[#1a1a1a] transition shadow-[0_0_15px_rgba(0,255,0,0.1)] flex items-center justify-center gap-2 border border-[#00FF00]/50 text-[10px] h-11"
                >
                  <QrCode size={16} />
                  LER QR CODE
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Modal */}
      {isLeaderboardOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-[#222] w-full max-w-2xl rounded-[2.5rem] shadow-2xl flex flex-col relative animate-in zoom-in duration-300 my-auto">
            <button 
              onClick={() => setIsLeaderboardOpen(false)}
              className="absolute top-6 right-6 p-2 bg-[#141414] border border-[#222] rounded-full hover:bg-[#222] transition text-zinc-400 z-10"
            >
              <X size={24} />
            </button>

            <div className="p-8 pb-4">
              <h2 className="text-2xl font-black text-[#00FF00] uppercase tracking-widest mb-1">HALL DA FAMA</h2>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Os melhores jogadores da LOUD BOOGLE</p>
            </div>

            <div className="p-4 sm:p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {/* Top Winners */}
              <div className="bg-[#111] p-6 rounded-3xl border border-[#222]">
                <h3 className="text-sm font-black flex items-center gap-3 mb-6 text-zinc-100 uppercase tracking-widest"><Trophy className="text-[#00FF00]" size={20}/> Top Vitórias</h3>
                <div className="space-y-3">
                  {topWinners.length === 0 ? <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs text-center py-4">Nenhum dado ainda.</p> : topWinners.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-4 p-3 bg-[#0a0a0a] rounded-2xl border border-[#222]">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-[#00FF00] text-black' : i === 1 ? 'bg-zinc-200 text-black' : i === 2 ? 'bg-orange-500 text-black' : 'bg-[#1a1a1a] text-zinc-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-zinc-100 text-sm">{u.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {u.goldTrophies > 0 && <span className="flex items-center gap-0.5 text-yellow-500 text-[10px] font-black"><Trophy size={10}/>{u.goldTrophies}</span>}
                          {u.silverTrophies > 0 && <span className="flex items-center gap-0.5 text-zinc-400 text-[10px] font-black"><Trophy size={10}/>{u.silverTrophies}</span>}
                          {u.bronzeTrophies > 0 && <span className="flex items-center gap-0.5 text-orange-500 text-[10px] font-black"><Trophy size={10}/>{u.bronzeTrophies}</span>}
                        </div>
                        {u.longestWordFound && (
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Maior: <span className="text-zinc-400 font-mono">{u.longestWordFound}</span></p>
                        )}
                      </div>
                      <div className="font-black text-[#00FF00] flex items-center gap-2 text-lg">
                        {u.wins || 0} <Medal size={16} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Total Score */}
              <div className="bg-[#111] p-6 rounded-3xl border border-[#222]">
                <h3 className="text-sm font-black flex items-center gap-3 mb-6 text-zinc-100 uppercase tracking-widest"><Database className="text-[#00FF00]" size={20}/> Top Pontuação Total</h3>
                <div className="space-y-3">
                  {topScore.length === 0 ? <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs text-center py-4">Nenhum dado ainda.</p> : topScore.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-4 p-3 bg-[#0a0a0a] rounded-2xl border border-[#222]">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${i === 0 ? 'bg-yellow-500 text-black' : 'bg-[#1a1a1a] text-zinc-500'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-zinc-100 text-sm">{u.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {u.goldTrophies > 0 && <span className="flex items-center gap-0.5 text-yellow-500 text-[10px] font-black"><Trophy size={10}/>{u.goldTrophies}</span>}
                          {u.silverTrophies > 0 && <span className="flex items-center gap-0.5 text-zinc-400 text-[10px] font-black"><Trophy size={10}/>{u.silverTrophies}</span>}
                          {u.bronzeTrophies > 0 && <span className="flex items-center gap-0.5 text-orange-500 text-[10px] font-black"><Trophy size={10}/>{u.bronzeTrophies}</span>}
                        </div>
                        {u.longestWordFound && (
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Maior: <span className="text-zinc-400 font-mono">{u.longestWordFound}</span></p>
                        )}
                      </div>
                      <div className="font-black text-[#00FF00] text-lg">
                        {u.totalScore || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Words */}
              <div className="bg-[#111] p-6 rounded-3xl border border-[#222]">
                <h3 className="text-sm font-black flex items-center gap-3 mb-6 text-zinc-100 uppercase tracking-widest"><Star className="text-[#00FF00]" size={20}/> Top Palavras</h3>
                <div className="space-y-3">
                  {topWords.length === 0 ? <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs text-center py-4">Nenhum dado ainda.</p> : topWords.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-4 p-3 bg-[#0a0a0a] rounded-2xl border border-[#222]">
                      <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center font-black text-sm text-[#00FF00]">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-zinc-100 text-sm">{u.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {u.goldTrophies > 0 && <span className="flex items-center gap-0.5 text-yellow-500 text-[10px] font-black"><Trophy size={10}/>{u.goldTrophies}</span>}
                          {u.silverTrophies > 0 && <span className="flex items-center gap-0.5 text-zinc-400 text-[10px] font-black"><Trophy size={10}/>{u.silverTrophies}</span>}
                          {u.bronzeTrophies > 0 && <span className="flex items-center gap-0.5 text-orange-500 text-[10px] font-black"><Trophy size={10}/>{u.bronzeTrophies}</span>}
                        </div>
                        {u.longestWordFound && (
                          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Maior: <span className="text-zinc-400 font-mono">{u.longestWordFound}</span></p>
                        )}
                      </div>
                      <div className="font-black text-[#00FF00] text-lg flex items-baseline gap-1">
                        {u.wordsFound || 0} <span className="text-[10px] text-zinc-600 uppercase tracking-widest">palavras</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-8 pt-4 text-center">
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Os dados são atualizados em tempo real após cada partida.</p>
            </div>
          </div>
        </div>
      )}

      {isEditingProfile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#222] p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-black text-zinc-100 mb-6 uppercase tracking-widest text-center">Editar Perfil</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Nome</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="bg-[#0a0a0a] border border-[#333] text-zinc-100 px-4 py-3 rounded-xl focus:outline-none focus:border-[#00FF00] transition font-bold"
                  placeholder="Seu nome"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setIsEditingProfile(false)} className="flex-1 bg-[#1a1a1a] border border-[#333] text-zinc-400 px-4 py-3 rounded-xl font-bold uppercase tracking-wider text-sm hover:bg-[#222] transition">
                Cancelar
              </button>
              <button onClick={handleSaveProfile} className="flex-1 bg-[#00FF00] text-black px-4 py-3 rounded-xl font-black uppercase tracking-wider text-sm hover:bg-[#00e600] transition shadow-[0_0_15px_rgba(0,255,0,0.2)]">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <WordBankModal
        isOpen={isWordBankOpen}
        onClose={() => setIsWordBankOpen(false)}
        userId={user?.uid}
        userName={profile?.name}
      />
    </div>
  );
}
