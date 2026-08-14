import React from 'react';
import { Hourglass } from 'lucide-react';

interface AnimatedTimerProps {
  timeLeft: number;
  totalDuration: number;
  size?: 'sm' | 'md' | 'lg' | 'tv';
  showProgressRing?: boolean;
  variant?: 'ring' | 'pill';
}

export default function AnimatedTimer({
  timeLeft,
  totalDuration,
  size = 'md',
  showProgressRing = true,
  variant = 'ring'
}: AnimatedTimerProps) {
  const safeTotal = Math.max(totalDuration || 180, 1);
  const fraction = Math.max(0, Math.min(1, timeLeft / safeTotal));
  const isUrgent = timeLeft <= 10 && timeLeft > 0;
  const isWarning = timeLeft <= 30 && timeLeft > 10;
  const isFinished = timeLeft === 0;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Dimensions based on size
  const radius = size === 'tv' ? 120 : size === 'lg' ? 64 : size === 'md' ? 36 : 22;
  const stroke = size === 'tv' ? 14 : size === 'lg' ? 8 : size === 'md' ? 5 : 3;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - fraction * circumference;

  const colorClass = isFinished
    ? 'text-zinc-600'
    : isUrgent
    ? 'text-red-500'
    : isWarning
    ? 'text-amber-400'
    : 'text-[#00FF00]';

  const glowClass = isFinished
    ? ''
    : isUrgent
    ? 'drop-shadow-[0_0_25px_rgba(239,68,68,0.6)]'
    : isWarning
    ? 'drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]'
    : 'drop-shadow-[0_0_20px_rgba(0,255,0,0.4)]';

  const strokeHex = isFinished
    ? '#3f3f46'
    : isUrgent
    ? '#ef4444'
    : isWarning
    ? '#f59e0b'
    : '#00FF00';

  if (variant === 'pill') {
    const isTV = size === 'tv';
    return (
      <div className={`flex items-center gap-2 ${isTV ? 'bg-black/30 backdrop-blur-md border-white/20 px-8 py-3 rounded-full' : 'bg-[#141414] border-[#333] px-3 md:px-5 py-1.5 md:py-2 rounded-full'} border-2 shadow-2xl relative overflow-hidden group ${isUrgent ? 'animate-pulse scale-105 border-red-500/50' : ''}`}>
        {/* Progress bar background */}
        <div 
          className="absolute left-0 bottom-0 h-1 bg-[#00FF00]/20 transition-all duration-1000 ease-linear"
          style={{ width: `${fraction * 100}%`, backgroundColor: strokeHex + (isTV ? '66' : '33') }}
        />
        <Hourglass size={isTV ? 28 : size === 'sm' ? 14 : 18} className={`${colorClass} ${isUrgent ? 'animate-spin-slow' : ''}`} />
        <span
          className={`font-mono font-black tabular-nums transition-all duration-300 ${colorClass} ${glowClass} ${
            isTV ? 'text-5xl' : 'text-base md:text-xl'
          }`}
        >
          {formattedTime}
        </span>
      </div>
    );
  }

  if (!showProgressRing) {
    return (
      <div className={`font-mono font-black tabular-nums transition-colors duration-300 flex items-center gap-2 ${colorClass} ${glowClass} ${isUrgent ? 'animate-pulse scale-110 transform' : ''}`}>
        <span>{formattedTime}</span>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${isUrgent ? 'animate-bounce-subtle' : ''}`}>
      <svg
        height={radius * 2}
        width={radius * 2}
        className="transform -rotate-90 origin-center transition-all duration-300"
      >
        {/* Track Background Ring */}
        <circle
          stroke="#1e1e1e"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Animated Progress Ring */}
        <circle
          stroke={strokeHex}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.85s linear, stroke 0.3s ease' }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>

      {/* Centered Digital Countdown */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span
          className={`font-mono font-black tabular-nums transition-all duration-300 ${colorClass} ${glowClass} ${
            size === 'tv'
              ? 'text-7xl font-extrabold'
              : size === 'lg'
              ? 'text-4xl'
              : size === 'md'
              ? 'text-lg font-black'
              : 'text-xs font-bold'
          } ${isUrgent ? 'scale-110' : ''}`}
        >
          {formattedTime}
        </span>
        {size === 'tv' && (
          <span className="text-zinc-500 font-bold uppercase tracking-widest text-sm mt-1">
            {isUrgent ? 'Últimos Segundos!' : 'Restante'}
          </span>
        )}
      </div>
    </div>
  );
}
