// Web Audio API Synthesizer for low-latency game sound effects

let audioCtx: AudioContext | null = null;
let isMuted = false;

// Load mute preference
try {
  const savedMute = localStorage.getItem('loud_boogle_muted');
  if (savedMute !== null) {
    isMuted = savedMute === 'true';
  }
} catch (e) {
  // Ignore
}

function getAudioContext(): AudioContext | null {
  if (isMuted) return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function isAudioMuted(): boolean {
  return isMuted;
}

export function setAudioMuted(muted: boolean) {
  isMuted = muted;
  try {
    localStorage.setItem('loud_boogle_muted', String(muted));
  } catch (e) {}
}

export function toggleAudioMute(): boolean {
  setAudioMuted(!isMuted);
  return isMuted;
}

/**
 * Letter select click sound with progressive pitch
 */
export function playSelectLetter(stepIndex: number = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Scale pitch based on word length (Pentatonic scale: C5 -> D5 -> E5 -> G5 -> A5 -> C6...)
    const baseFreq = 523.25; // C5
    const semitones = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    const shift = semitones[Math.min(stepIndex, semitones.length - 1)] || 0;
    const freq = baseFreq * Math.pow(2, shift / 12);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch (e) {}
}

/**
 * Valid word found chime
 */
export function playWordSuccess(score: number = 1) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const chord = score >= 3 ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880.0, 1174.66];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.04);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.04 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + i * 0.04);
      osc.stop(ctx.currentTime + i * 0.04 + 0.29);
    });
  } catch (e) {}
}

/**
 * Invalid word error buzz
 */
export function playWordError() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.19);
  } catch (e) {}
}

/**
 * Timer tick during gameplay
 */
export function playTimerTick(isUrgent: boolean = false) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isUrgent ? 880 : 440, ctx.currentTime);

    gain.gain.setValueAtTime(isUrgent ? 0.08 : 0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (isUrgent ? 0.08 : 0.04));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + (isUrgent ? 0.08 : 0.04));
  } catch (e) {}
}

/**
 * Game Over horn / gong
 */
export function playGameOver() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [440, 370, 311, 220];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.36);
    });
  } catch (e) {}
}

/**
 * Victory fanfare
 */
export function playVictorySound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [
      { f: 523.25, d: 0.12, t: 0 },
      { f: 659.25, d: 0.12, t: 0.12 },
      { f: 783.99, d: 0.14, t: 0.24 },
      { f: 1046.5, d: 0.45, t: 0.38 }
    ];

    notes.forEach(({ f, d, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, ctx.currentTime + t);

      gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + d + 0.05);
    });
  } catch (e) {}
}

/**
 * Step replay click sound
 */
export function playReplayStep() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}
