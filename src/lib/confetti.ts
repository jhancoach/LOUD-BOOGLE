import confetti from 'canvas-confetti';

/**
 * Triggers a multi-stage celebratory confetti explosion for match winners.
 */
export function fireWinnerConfetti() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
    colors: ['#00FF00', '#39FF14', '#FFFFFF', '#FFD700', '#22C55E', '#A3E635', '#00FFFF'],
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // 1. Initial central blast with mixed velocities
  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });

  fire(0.2, {
    spread: 60,
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 1.2,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.5,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });

  // 2. Side cannons sequence at 250ms and 500ms
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 75,
      origin: { x: 0, y: 0.65 },
      colors: defaults.colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 75,
      origin: { x: 1, y: 0.65 },
      colors: defaults.colors,
      zIndex: 9999,
    });
  }, 250);

  setTimeout(() => {
    confetti({
      particleCount: 100,
      angle: 90,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: defaults.colors,
      zIndex: 9999,
      shapes: ['square', 'circle'],
    });
  }, 600);
}

/**
 * Continuous subtle fireworks/celebration cannon while on winner screen
 */
export function startVictoryLoop(durationMs: number = 2500) {
  fireWinnerConfetti();
  const end = Date.now() + durationMs;

  const interval: any = setInterval(() => {
    if (Date.now() > end) {
      return clearInterval(interval);
    }

    confetti({
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      origin: {
        x: Math.random(),
        y: Math.random() * 0.5 + 0.1,
      },
      colors: ['#00FF00', '#FFD700', '#FFFFFF', '#39FF14'],
      zIndex: 9999,
      particleCount: 30,
    });
  }, 400);

  return () => clearInterval(interval);
}
