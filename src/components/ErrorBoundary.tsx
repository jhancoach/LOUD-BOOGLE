import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col items-center justify-center p-8 text-center font-sans">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Ops! Algo deu errado</h1>
          <p className="text-zinc-400 mb-8 max-w-md font-bold uppercase tracking-wider text-sm leading-relaxed">
            Ocorreu um erro inesperado na interface. Tente atualizar a página ou voltar para o início.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-[#00FF00] text-black px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#00e600] transition shadow-lg"
            >
              Recarregar Página
            </button>
            <button
              onClick={() => window.location.href = window.location.origin}
              className="bg-[#1a1a1a] border border-[#333] text-zinc-300 px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#222] transition"
            >
              Ir para o Início
            </button>
          </div>
          {this.state.error && (
            <div className="mt-12 p-4 bg-red-950/20 border border-red-500/10 rounded-xl text-left max-w-2xl w-full overflow-auto">
              <p className="text-[10px] text-red-400 font-mono break-all">{this.state.error.toString()}</p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
