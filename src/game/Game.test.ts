import { describe, expect, it } from 'vitest';
import { Game, MAX_LIVES } from './Game';
import { autoSolve } from '../engine/evaluator';
import { emptyPersisted } from '../storage';
import { mulberry32 } from '../util/rng';
import type { Position } from '../fretboard/fretboard';

function newGame(seed = 1, unlockAll = false) {
  return new Game({ initial: emptyPersisted(), rng: mulberry32(seed), unlockAll });
}

/** Plays the current challenge perfectly. */
function solveCurrent(g: Game) {
  const s = g.getSnapshot();
  const ch = s.challenge!;
  const anchors: (Position | undefined)[] = [];
  for (let i = s.stepIndex; i < ch.steps.length; i++) {
    const cur = g.getSnapshot();
    const step = ch.steps[i];
    if (cur.revealMsLeft > 0) g.tick(cur.revealMsLeft + 1);
    if (step.spec.type === 'choice') {
      g.choose(step.spec.options.indexOf(step.spec.answer));
      continue;
    }
    for (const p of autoSolve(step.spec, g.getSnapshot().progress!, { anchors: (g as any).anchors }, 3)) g.click(p);
  }
  void anchors;
}

function advance(g: Game) {
  const s = g.getSnapshot();
  if (s.phase === 'discovery') g.next();
  else g.tick(600);
}

describe('Game', () => {
  it('perfect bot: scores, streaks, levels up, unlocks intervals, ends on time', () => {
    const g = newGame(7);
    g.start({ mode: 'mix', minutes: 5 });
    let guard = 0;
    while (g.getSnapshot().phase !== 'summary' && guard++ < 400) {
      const s = g.getSnapshot();
      if (s.phase === 'playing') {
        if ((g as any).advanceInMs > 0) g.tick(600);
        else {
          solveCurrent(g);
          advance(g);
        }
      } else advance(g);
      g.tick(1500); // simulated thinking time
    }
    const s = g.getSnapshot();
    expect(s.phase).toBe('summary');
    expect(s.summary!.total).toBeGreaterThan(15);
    expect(s.summary!.perfect).toBe(s.summary!.total);
    expect(s.summary!.bestStreak).toBeGreaterThan(20);
    expect(s.levels.notes).toBeGreaterThan(1);
    expect(g.isUnlocked('intervals')).toBe(true);
  });

  it('wrong clicks cost lives, reset streak and end the session at 0', () => {
    const g = newGame(3);
    g.start({ mode: 'notes', minutes: 5 });
    expect(g.getSnapshot().lives).toBe(MAX_LIVES);
    let guard = 0;
    while (g.getSnapshot().phase !== 'summary' && guard++ < 200) {
      const s = g.getSnapshot();
      if (s.phase === 'discovery') { g.next(); continue; }
      if ((g as any).advanceInMs > 0) { g.tick(600); continue; }
      if (s.revealMsLeft > 0) { g.tick(s.revealMsLeft + 1); continue; }
      // click a position that is certainly wrong: an open string of a different note than requested
      const spec = s.challenge!.steps[s.stepIndex].spec;
      if (spec.type !== 'note') { g.skip(); continue; }
      const bad: Position[] = [0, 1, 2, 3, 4, 5].flatMap((st) => [0, 1, 2].map((f) => ({ string: st, fret: f })));
      for (const p of bad) {
        if (g.getSnapshot().phase !== 'playing') break;
        g.click(p);
      }
    }
    const s = g.getSnapshot();
    expect(s.phase).toBe('summary');
    expect(s.summary!.reason).toBe('lives');
    expect(s.summary!.tip).toMatch(/Practica más/);
  });

  it('giving up shows the answer, costs a life and breaks the streak', () => {
    const g = newGame(11);
    g.start({ mode: 'notes', minutes: 15 });
    g.skip();
    const s = g.getSnapshot();
    expect(s.phase).toBe('discovery');
    expect(s.discovery!.fail).toBe(true);
    expect(s.solution.length).toBeGreaterThan(0);
    expect(s.lives).toBe(MAX_LIVES - 1);
    g.next();
    expect(g.getSnapshot().phase).toBe('playing');
  });
});
