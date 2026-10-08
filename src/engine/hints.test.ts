import { describe, expect, it } from 'vitest';
import { generateChallenge } from '../challenges/generate';
import { Game } from '../game/Game';
import { emptyPersisted } from '../storage';
import { mulberry32 } from '../util/rng';
import { MAX_LEVEL, STAGES } from '../progression/stages';
import { emptySrs } from '../srs/srs';
import { evaluateClick, initProgress } from './evaluator';
import { hintFor } from './hints';

describe('hints', () => {
  it('are progressive and the last one highlights a valid spot', () => {
    for (const stage of STAGES) {
      for (let level = 1; level <= MAX_LEVEL; level++) {
        const rng = mulberry32(level + 31);
        for (let i = 0; i < 25; i++) {
          const ch = generateChallenge({ stage: stage.id, level, srs: emptySrs(), rng, id: i, recentKinds: [] });
          const step = ch.steps[0];
          const ctx = { anchors: [] };
          const prog = initProgress(step.spec, ctx);
          const texts: string[] = [];
          let pos;
          for (let l = 0; l < 5; l++) {
            const h = hintFor(step.spec, prog, ctx, l);
            if (!h) break;
            expect(h.text.length).toBeGreaterThan(0);
            texts.push(h.text);
            if (h.pos) pos = h.pos;
          }
          expect(texts.length).toBeGreaterThan(0);
          if (step.spec.type !== 'choice' && step.spec.type !== 'chord' || (step.spec.type === 'chord' && texts.length === 3)) {
            if (pos) expect(evaluateClick(step.spec, prog, pos, ctx).outcome).toBe('correct');
          }
          if (step.reveal) continue;
        }
      }
    }
  });

  it('using hints or reveal makes a solve non-perfect', () => {
    const g = new Game({ initial: emptyPersisted(), rng: mulberry32(2) });
    g.start({ mode: 'notes', minutes: 5 });
    g.setReveal(true);
    expect(g.getSnapshot().reveal).toBe(true);
    g.hint();
    expect(g.getSnapshot().hints.length).toBe(1);
    g.home();
    expect(g.getSnapshot().phase).toBe('idle');
  });
});
