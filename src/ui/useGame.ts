import { useEffect, useSyncExternalStore } from 'react';
import { autoSolve } from '../engine/evaluator';
import { Game } from '../game/Game';
import { loadPersisted, savePersisted } from '../storage';
import { mulberry32 } from '../util/rng';

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export const game = new Game({
  initial: loadPersisted(),
  rng: mulberry32((Date.now() ^ 0x9e3779b9) >>> 0),
  save: savePersisted,
  // All stages are open by default; `?gate=1` restores performance-based unlocking.
  unlockAll: params.get('gate') !== '1',
});

export function useGame() {
  const snap = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const running = snap.phase === 'playing';
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      // clamp so a hidden tab does not burn the session clock
      game.tick(Math.min(250, now - last));
      last = now;
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);
  return snap;
}

if (params.has('debug')) {
  // Dev helper: lets you drive the game from the console / automated browser checks.
  const w = window as unknown as Record<string, unknown>;
  w.__game = game;
  w.__solve = () => {
    const s = game.getSnapshot();
    const step = s.challenge!.steps[s.stepIndex];
    if (step.spec.type === 'choice') return game.choose(step.spec.options.indexOf(step.spec.answer));
    const anchors = (game as unknown as { anchors: never[] }).anchors;
    for (const p of autoSolve(step.spec, game.getSnapshot().progress!, { anchors }, 3)) game.click(p);
  };
}
