import { useState, useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { loginWithGoogle, loginAnonymously, logout, db } from '../lib/firebase';
import { createRoom } from '../lib/room';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Trophy, Users, Play, LogOut, Medal, Star, Clock, QrCode, Gamepad2, X, Edit2, Database, BookOpen, MonitorPlay } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import WordBankModal from '../components/WordBankModal';

export default function Home({ onJoinRoom, onStartOffline }: { onJoinRoom: (id: string) => void, onStartOffline?: (settings: { gridSize: number, duration: number, minWordLength: number }) => void }) {
  const { user, profile, loading } = useAuth();
  const [roomIdInput, setRoomIdInput] = useState('');
  const [gridSize, setGridSize] = useState(4);
  const [minWordLength, setMinWordLength] = useState(3);
  const [duration, setDuration] = useState(180);
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isWordBankOpen, setIsWordBankOpen] = useState(false);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');

  const [topWinners, setTopWinners] = useState<any[]>([]);
  const [topWords, setTopWords] = useState<any[]>([]);

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
    const unsubWins = onSnapshot(qWins, (snap) => setTopWinners(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    const qWords = query(collection(db, 'users'), orderBy('wordsFound', 'desc'), limit(5));
    const unsubWords = onSnapshot(qWords, (snap) => setTopWords(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    return () => { unsubWins(); unsubWords(); };
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
               <Scanner onResult={(text) => handleScan(text)} />
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
    if (!user) return;
    const id = await createRoom(user.uid, gridSize, minWordLength, duration);
    onJoinRoom(id);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans p-4 md:p-8 flex flex-col justify-center">
      <div className="max-w-6xl w-full mx-auto flex flex-col md:flex-row gap-8 items-center">
        
        {/* Left Side: Actions */}
        <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-center bg-[#141414] p-8 md:p-12 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-[#222222] relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00FF00]/5 blur-[100px] pointer-events-none rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00FF00]/5 blur-[100px] pointer-events-none rounded-full"></div>

          <div className="flex flex-col items-center mb-10 relative z-10">
            <h1 className="text-6xl font-black text-[#00FF00] tracking-widest uppercase mb-1 drop-shadow-[0_0_15px_rgba(0,255,0,0.3)]">LOUD</h1>
            <h2 className="text-2xl font-black tracking-[0.35em] uppercase text-zinc-100 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">BOOGLE</h2>
          </div>

          {!user ? (
            <div className="w-full space-y-4 relative z-10">
              <button onClick={loginWithGoogle} className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold hover:bg-zinc-200 transition shadow-lg flex items-center justify-center gap-3">
                <svg className="w-6 h-6" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                ENTRAR COM GOOGLE
              </button>
              
              <button onClick={loginAnonymously} className="w-full bg-[#00FF00] text-black px-6 py-4 rounded-xl font-black hover:bg-[#00e600] transition shadow-[0_0_20px_rgba(0,255,0,0.2)] tracking-wide uppercase flex items-center justify-center gap-2">
                <Play size={20} fill="currentColor" /> JOGAR COMO CONVIDADO (ONLINE)
              </button>

              <button onClick={() => onStartOffline && onStartOffline({ gridSize: 4, duration: 180, minWordLength: 3 })} className="w-full bg-[#161616] border border-[#333333] text-zinc-300 px-6 py-3.5 rounded-xl font-bold hover:bg-[#222] transition tracking-wider uppercase text-xs flex items-center justify-center gap-2">
                <Gamepad2 size={16} className="text-[#00FF00]" /> MODO TREINO (SOLO / OFFLINE)
              </button>

              <div className="pt-2 flex justify-center">
                <button 
                  onClick={() => setIsWordBankOpen(true)}
                  className="text-xs font-black text-zinc-400 hover:text-[#00FF00] flex items-center gap-1.5 uppercase tracking-wider transition"
                >
                  <BookOpen size={14} className="text-[#00FF00]" /> Ver Dicionário IME-USP (245k+)
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-8 relative z-10">
              <div className="flex items-center justify-between bg-[#0a0a0a] p-4 rounded-xl border border-[#222]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#00FF00] rounded-full flex items-center justify-center text-black font-black text-xl uppercase shadow-[0_0_15px_rgba(0,255,0,0.3)]">
                    {profile?.name?.[0] || user.uid[0]}
                  </div>
                  <div>
                    <h2 className="font-bold text-zinc-100">{profile?.name || 'Jogador'}</h2>
                    <p className="text-xs tracking-wider text-[#00FF00] font-bold uppercase">{profile?.wins || 0} Vitórias • {profile?.wordsFound || 0} Palavras</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsWordBankOpen(true)} className="p-3 text-zinc-500 hover:text-[#00FF00] hover:bg-[#1a1a1a] transition rounded-lg" title="Banco de Palavras">
                    <Database size={20} />
                  </button>
                  <button onClick={() => setIsEditingProfile(true)} className="p-3 text-zinc-500 hover:text-[#00FF00] hover:bg-[#1a1a1a] transition rounded-lg" title="Editar Perfil">
                    <Edit2 size={20} />
                  </button>
                  <button onClick={logout} className="p-3 text-zinc-500 hover:text-red-500 hover:bg-[#1a1a1a] transition rounded-lg" title="Sair">
                    <LogOut size={20} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-widest text-sm"><Play size={18} className="text-[#00FF00]" /> Configurar Sala</h3>
                  <button 
                    onClick={() => setIsWordBankOpen(true)}
                    className="text-xs font-black text-[#00FF00] hover:text-[#00e600] flex items-center gap-1.5 uppercase tracking-wider bg-[#00FF00]/10 px-2.5 py-1 rounded-lg border border-[#00FF00]/20 transition"
                  >
                    <BookOpen size={13} /> Banco de Palavras
                  </button>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Tabuleiro</label>
                    <div className="flex gap-2">
                      {[4, 5, 6, 7, 8].map(size => (
                        <button key={size} onClick={() => setGridSize(size)} className={`flex-1 py-3 rounded-lg font-black text-sm transition border ${gridSize === size ? 'bg-[#00FF00] text-black border-[#00FF00] shadow-[0_0_15px_rgba(0,255,0,0.2)]' : 'bg-[#0a0a0a] text-zinc-400 border-[#222] hover:bg-[#1a1a1a]'}`}>
                          {size}x{size}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Tempo (Segundos)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[60, 120, 180].map(time => (
                        <button key={time} onClick={() => setDuration(time)} className={`py-3 rounded-lg font-black text-sm transition border ${duration === time ? 'bg-[#00FF00] text-black border-[#00FF00] shadow-[0_0_15px_rgba(0,255,0,0.2)]' : 'bg-[#0a0a0a] text-zinc-400 border-[#222] hover:bg-[#1a1a1a]'}`}>
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button onClick={handleCreateRoom} className="flex-1 bg-[#00FF00] text-black px-6 py-4 rounded-xl font-black uppercase tracking-wider text-sm hover:bg-[#00e600] transition shadow-[0_0_20px_rgba(0,255,0,0.2)]">
                      Criar Sala
                    </button>
                    <button onClick={() => onStartOffline && onStartOffline({ gridSize, duration, minWordLength })} className="flex-1 bg-[#1a1a1a] border border-[#00FF00]/30 text-[#00FF00] px-6 py-4 rounded-xl font-bold uppercase tracking-wider text-sm hover:bg-[#222] transition">
                      Treinar
                    </button>
                  </div>
                  <button onClick={async () => {
                    const id = await createRoom('tv', gridSize, minWordLength, duration);
                    window.location.href = `/?room=${id}&tv=true`;
                  }} className="w-full bg-[#0a0a0a] border border-[#333] text-zinc-300 px-6 py-4 rounded-xl font-bold uppercase tracking-wider text-sm hover:bg-[#111] transition flex items-center justify-center gap-3">
                    <MonitorPlay size={18} /> Iniciar na TV
                  </button>
                </div>
              </div>

              <div className="border-t border-[#222] pt-6">
                <h3 className="font-bold text-zinc-100 mb-4 flex items-center gap-2 uppercase tracking-widest text-sm"><Users size={18} className="text-[#00FF00]" /> Entrar</h3>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="ID DA SALA" 
                      className="flex-1 bg-[#0a0a0a] border border-[#333] text-zinc-100 px-4 py-4 rounded-xl focus:outline-none focus:border-[#00FF00] transition font-mono font-bold uppercase placeholder-zinc-700 text-center tracking-widest"
                      value={roomIdInput}
                      onChange={e => setRoomIdInput(e.target.value)}
                    />
                    <button 
                      disabled={!roomIdInput.trim()}
                      onClick={() => onJoinRoom(roomIdInput.trim())} 
                      className="bg-[#222] text-zinc-100 px-8 py-4 rounded-xl font-bold hover:bg-[#333] transition uppercase tracking-wider text-sm disabled:opacity-50"
                    >
                      Ir
                    </button>
                  </div>
                  
                  <div className="relative flex items-center">
                    <div className="flex-grow border-t border-[#222]"></div>
                    <span className="flex-shrink-0 mx-4 text-zinc-600 text-xs font-black tracking-widest uppercase">OU</span>
                    <div className="flex-grow border-t border-[#222]"></div>
                  </div>

                  <button 
                    onClick={() => setIsScannerOpen(true)}
                    className="w-full bg-[#111] text-[#00FF00] px-6 py-5 rounded-xl font-black uppercase tracking-widest hover:bg-[#1a1a1a] transition shadow-[0_0_20px_rgba(0,255,0,0.1)] hover:shadow-[0_0_30px_rgba(0,255,0,0.2)] flex items-center justify-center gap-3 border border-[#00FF00]/50"
                  >
                    <QrCode size={24} />
                    ABRIR CÂMERA
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Leaderboard */}
        <div className="flex-1 w-full max-w-lg space-y-6 hidden md:block">
          <div className="bg-[#141414] p-8 rounded-3xl shadow-2xl border border-[#222]">
            <h2 className="text-lg font-black flex items-center gap-3 mb-6 text-zinc-100 uppercase tracking-widest"><Trophy className="text-[#00FF00]" size={24}/> Top Vitórias</h2>
            <div className="space-y-4">
              {topWinners.length === 0 ? <p className="text-zinc-600 font-bold uppercase tracking-widest text-sm text-center py-8">Nenhum dado ainda.</p> : topWinners.map((u, i) => (
                <div key={u.id} className="flex items-center gap-5 p-4 bg-[#0a0a0a] rounded-2xl border border-[#222]">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${i === 0 ? 'bg-[#00FF00] text-black shadow-[0_0_15px_rgba(0,255,0,0.5)]' : i === 1 ? 'bg-zinc-200 text-black' : i === 2 ? 'bg-orange-500 text-black' : 'bg-[#222] text-zinc-500'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-100 text-lg">{u.name}</p>
                  </div>
                  <div className="font-black text-[#00FF00] flex items-center gap-2 text-xl">
                    {u.wins} <Medal size={20} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#141414] p-8 rounded-3xl shadow-2xl border border-[#222]">
            <h2 className="text-lg font-black flex items-center gap-3 mb-6 text-zinc-100 uppercase tracking-widest"><Star className="text-[#00FF00]" size={24}/> Top Palavras</h2>
            <div className="space-y-4">
              {topWords.length === 0 ? <p className="text-zinc-600 font-bold uppercase tracking-widest text-sm text-center py-8">Nenhum dado ainda.</p> : topWords.map((u, i) => (
                <div key={u.id} className="flex items-center gap-5 p-4 bg-[#0a0a0a] rounded-2xl border border-[#222]">
                  <div className="w-10 h-10 rounded-xl bg-[#222] flex items-center justify-center font-black text-lg text-[#00FF00]">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-100 text-lg">{u.name}</p>
                  </div>
                  <div className="font-black text-[#00FF00] text-xl flex items-baseline gap-1">
                    {u.wordsFound} <span className="text-xs text-zinc-600 uppercase tracking-widest">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
