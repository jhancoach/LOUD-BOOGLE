import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { Copy, Check, Share2, ExternalLink, QrCode as QrIcon } from 'lucide-react';

interface QRGeneratorProps {
  value: string;
  title?: string;
  subtitle?: string;
  size?: number;
  showShareButtons?: boolean;
  accentColor?: string;
}

export default function QRGenerator({
  value,
  title = 'Aponte a Câmera',
  subtitle = 'Escaneie para entrar na sala',
  size = 180,
  showShareButtons = true,
}: QRGeneratorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Falha ao copiar link', e);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LOUD BOOGLE - Sala de Jogo',
          text: 'Entre na minha sala do LOUD BOOGLE para jogar!',
          url: value,
        });
      } catch (err) {
        // Usuário cancelou ou navegador não suportou
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-[#111] rounded-3xl border border-[#222] shadow-[0_0_30px_rgba(0,0,0,0.6)] text-center">
      {/* Header Info */}
      {title && (
        <div className="mb-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-100 flex items-center justify-center gap-1.5">
            <QrIcon size={16} className="text-[#00FF00]" /> {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Styled QR Code Box with Neon Halo */}
      <div className="bg-white p-3.5 rounded-2xl border-2 border-[#00FF00] shadow-[0_0_25px_rgba(0,255,0,0.25)] inline-block transition-transform hover:scale-105 duration-200">
        <QRCode
          value={value}
          size={size}
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
          viewBox={`0 0 256 256`}
        />
      </div>

      {/* Action Buttons */}
      {showShareButtons && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center w-full max-w-xs">
          <button
            onClick={handleCopy}
            className={`flex-1 py-2 px-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition border ${
              copied
                ? 'bg-[#00FF00] text-black border-[#00FF00]'
                : 'bg-[#181818] text-zinc-300 border-[#333] hover:bg-[#222] hover:text-white'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado!' : 'Copiar Link'}
          </button>

          {'share' in navigator && (
            <button
              onClick={handleShare}
              className="py-2 px-3 bg-[#181818] hover:bg-[#222] text-[#00FF00] rounded-xl font-black text-xs uppercase tracking-wider border border-[#00FF00]/30 transition flex items-center gap-1.5"
              title="Compartilhar"
            >
              <Share2 size={14} /> Compartilhar
            </button>
          )}

          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="py-2 px-2.5 bg-[#181818] hover:bg-[#222] text-zinc-400 hover:text-zinc-200 rounded-xl text-xs border border-[#333] transition flex items-center"
            title="Abrir em Nova Aba"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </div>
  );
}
