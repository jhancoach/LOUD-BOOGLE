import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Search, BookOpen, Sparkles, Check, AlertCircle, Database, Layers, ExternalLink } from 'lucide-react';
import { CustomWordItem, subscribeCustomWords, addCustomWords, removeCustomWord, searchUspWords, getUspDictionaryStats } from '../lib/wordBank';
import { normalizeWord } from '../lib/utils';

interface WordBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userName?: string;
}

export default function WordBankModal({ isOpen, onClose, userId, userName }: WordBankModalProps) {
  const [activeTab, setActiveTab] = useState<'custom' | 'add' | 'builtin'>('builtin');
  const [customWords, setCustomWords] = useState<CustomWordItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(getUspDictionaryStats());
  
  // Form state
  const [inputWords, setInputWords] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeCustomWords((list) => {
      setCustomWords(list);
    });
    setStats(getUspDictionaryStats());
    const interval = setInterval(() => {
      setStats(getUspDictionaryStats());
    }, 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [isOpen]);

  const filteredCustomWords = useMemo(() => {
    if (!searchTerm.trim()) return customWords;
    const term = normalizeWord(searchTerm);
    return customWords.filter(w => w.word.includes(term));
  }, [customWords, searchTerm]);

  const searchedUspWords = useMemo(() => {
    return searchUspWords(searchTerm, 120);
  }, [searchTerm, stats.isLoaded]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputWords.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await addCustomWords(inputWords, userId, userName);
      if (res.added > 0) {
        setFeedback({
          type: 'success',
          message: `${res.added} palavra(s) adicionada(s) com sucesso ao banco!`
        });
        setInputWords('');
        setTimeout(() => setActiveTab('custom'), 1200);
      } else {
        setFeedback({
          type: 'error',
          message: 'Nenhuma palavra nova válida para adicionar.'
        });
      }
    } catch (e) {
      setFeedback({
        type: 'error',
        message: 'Erro ao conectar ao banco de dados.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (wordId: string) => {
    await removeCustomWord(wordId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-[#262626] w-full max-w-2xl rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-[#222] flex justify-between items-center bg-[#181818]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00FF00]/10 border border-[#00FF00]/30 rounded-2xl text-[#00FF00] shadow-[0_0_15px_rgba(0,255,0,0.2)]">
              <Database size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                Banco de Palavras <span className="text-xs bg-[#00FF00] text-black px-2 py-0.5 rounded font-black tracking-wider">LOUD BOOGLE</span>
              </h2>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider mt-0.5">
                Dicionário Oficial IME-USP + Termos Personalizados
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-[#222] rounded-xl transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 gap-3 p-4 bg-[#0d0d0d] border-b border-[#222]">
          <div className="bg-[#141414] p-3 rounded-2xl border border-[#222] flex items-center gap-3">
            <div className="p-2 bg-[#00FF00]/10 border border-[#00FF00]/30 rounded-xl text-[#00FF00]">
              <BookOpen size={18} />
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                Dicionário IME-USP <span className="w-2 h-2 rounded-full bg-[#00FF00] inline-block animate-pulse"></span>
              </p>
              <p className="text-sm font-black text-zinc-100 uppercase tracking-wider">
                {stats.totalWords.toLocaleString('pt-BR')} Palavras
              </p>
            </div>
          </div>

          <div className="bg-[#141414] p-3 rounded-2xl border border-[#222] flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-xl text-zinc-300">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Customizadas</p>
              <p className="text-sm font-black text-[#00FF00] uppercase tracking-wider">{customWords.length} Adicionadas</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#222] bg-[#111] px-6 pt-2">
          <button
            onClick={() => { setActiveTab('builtin'); setFeedback(null); }}
            className={`pb-3 px-4 font-black uppercase tracking-widest text-xs border-b-2 transition flex items-center gap-2 ${
              activeTab === 'builtin'
                ? 'border-[#00FF00] text-[#00FF00]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen size={14} /> Dicionário IME-USP (245k+)
          </button>
          <button
            onClick={() => { setActiveTab('custom'); setFeedback(null); }}
            className={`pb-3 px-4 font-black uppercase tracking-widest text-xs border-b-2 transition flex items-center gap-2 ${
              activeTab === 'custom'
                ? 'border-[#00FF00] text-[#00FF00]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers size={14} /> Personalizadas ({customWords.length})
          </button>
          <button
            onClick={() => { setActiveTab('add'); setFeedback(null); }}
            className={`pb-3 px-4 font-black uppercase tracking-widest text-xs border-b-2 transition flex items-center gap-2 ${
              activeTab === 'add'
                ? 'border-[#00FF00] text-[#00FF00]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Plus size={14} /> Incluir Palavras
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#0f0f0f]">
          
          {/* TAB 1: USP DICTIONARY EXPLORER */}
          {activeTab === 'builtin' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center bg-[#141414] p-3 rounded-2xl border border-[#222] text-xs text-zinc-400 font-bold">
                <span className="flex items-center gap-1.5 text-zinc-300">
                  <Check size={14} className="text-[#00FF00]" /> Banco integrado de <strong className="text-zinc-100">br-utf8.txt (IME-USP)</strong>
                </span>
                <a 
                  href="https://www.ime.usp.br/~pf/dicios/br-utf8.txt" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[#00FF00] hover:underline flex items-center gap-1 uppercase tracking-wider text-[10px]"
                >
                  Ver Fonte Original <ExternalLink size={12} />
                </a>
              </div>

              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Pesquise qualquer uma das 245.000+ palavras do IME-USP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#161616] border border-[#333] pl-10 pr-4 py-2.5 rounded-xl text-sm font-bold text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#00FF00]"
                />
              </div>

              <div className="flex flex-wrap gap-2 max-h-[320px] overflow-y-auto pr-2">
                {searchedUspWords.map((word, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 bg-[#161616] hover:bg-[#222] border border-[#2a2a2a] text-zinc-300 rounded-lg text-xs font-mono uppercase tracking-wider transition"
                  >
                    {word}
                  </span>
                ))}
              </div>
              <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest text-center mt-1">
                Todas as 245.115 palavras do dicionário são validadas instantaneamente em 0ms durante as partidas.
              </p>
            </div>
          )}

          {/* TAB 2: CUSTOM WORDS LIST */}
          {activeTab === 'custom' && (
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Pesquisar palavra no banco customizado..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#161616] border border-[#333] pl-10 pr-4 py-2.5 rounded-xl text-sm font-bold text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#00FF00]"
                />
              </div>

              {filteredCustomWords.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] flex items-center justify-center text-zinc-600 mb-3 border border-[#2a2a2a]">
                    <Layers size={24} />
                  </div>
                  <p className="text-zinc-400 font-bold uppercase tracking-wider text-sm">
                    {searchTerm ? 'Nenhuma palavra encontrada' : 'Nenhuma palavra customizada cadastrada ainda'}
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Adicione gírias, nomes de jogadores ou termos específicos na aba "Incluir Palavras".
                  </p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-4 px-4 py-2 bg-[#00FF00] text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-[#00e600] transition"
                  >
                    Adicionar Agora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredCustomWords.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 bg-[#141414] hover:bg-[#1a1a1a] rounded-xl border border-[#222] transition group"
                    >
                      <div>
                        <span className="font-black text-zinc-100 uppercase tracking-wider text-sm">
                          {item.word}
                        </span>
                        {item.addedByName && (
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                            por {item.addedByName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="opacity-60 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-950/30 rounded-lg transition"
                        title="Remover do banco"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADD WORDS FORM */}
          {activeTab === 'add' && (
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                  Digitar ou Colar Palavras
                </label>
                <textarea
                  rows={4}
                  value={inputWords}
                  onChange={(e) => setInputWords(e.target.value)}
                  placeholder="Ex: NOBRU, CORINGA, BAK, THURZIN, CAUAN, BOOGLE, ESPORT..."
                  className="w-full bg-[#161616] border border-[#333] p-3 rounded-xl text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#00FF00]"
                />
                <p className="text-zinc-600 text-[11px] font-bold mt-1 uppercase tracking-wider">
                  Separe múltiplas palavras por vírgula ou quebra de linha. Acentos são convertidos automaticamente.
                </p>
              </div>

              {feedback && (
                <div className={`p-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border ${
                  feedback.type === 'success' 
                    ? 'bg-[#00FF00]/10 text-[#00FF00] border-[#00FF00]/30' 
                    : 'bg-red-950/30 text-red-400 border-red-500/30'
                }`}>
                  {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                  {feedback.message}
                </div>
              )}

              <div className="bg-[#141414] p-4 rounded-2xl border border-[#222]">
                <h4 className="text-xs font-black text-zinc-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#00FF00]" /> Sugestões de Pacotes Rápidos
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setInputWords("LOUD, CORINGA, NOBRU, BAK, THURZIN, CAUAN, CROCODILE, LOST, PLAY, GAME")}
                    className="px-3 py-1.5 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-zinc-300 border border-[#333] rounded-lg text-xs font-bold uppercase tracking-wider transition"
                  >
                    + Termos LOUD
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputWords("HEADSHOT, RUSH, CLAN, LOOT, NERF, BUFF, META, GUILDA, TROFEU, ARENA")}
                    className="px-3 py-1.5 bg-[#1f1f1f] hover:bg-[#2a2a2a] text-zinc-300 border border-[#333] rounded-lg text-xs font-bold uppercase tracking-wider transition"
                  >
                    + Termos Gamer & Esports
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !inputWords.trim()}
                className="mt-2 w-full py-3.5 bg-[#00FF00] hover:bg-[#00e600] text-black font-black uppercase tracking-widest text-sm rounded-xl transition shadow-[0_0_20px_rgba(0,255,0,0.2)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus size={18} /> {isSubmitting ? 'Salvando...' : 'Salvar Palavras no Banco'}
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222] bg-[#111] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#1f1f1f] text-zinc-300 hover:bg-[#2a2a2a] rounded-xl font-black uppercase tracking-widest text-xs border border-[#333] transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}

