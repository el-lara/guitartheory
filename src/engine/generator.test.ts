import { describe, expect, it } from 'vitest';
import { generateChallenge } from '../challenges/generate';
import { evaluateChoice, evaluateClick, initProgress, autoSolve, stepAnchor } from './evaluator';
import { MAX_LEVEL, STAGES } from '../progression/stages';
import { emptySrs } from '../srs/srs';
import { mulberry32 } from '../util/rng';
import type { Position } from '../fretboard/fretboard';
import type { StepProgress } from './types';

describe('generated challenges are solvable by a perfect bot', () => {
  for (const stage of STAGES) {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      it(`${stage.id} level ${level}`, () => {
        const rng = mulberry32(level * 100 + stage.id.length);
        const kinds = new Set<string>();
        const recent: string[] = [];
        for (let i = 0; i < 120; i++) {
          const ch = generateChallenge({ stage: stage.id, level, srs: emptySrs(), rng, id: i, recentKinds: recent });
          recent.push(ch.kind);
          kinds.add(ch.kind);
          const anchors: (Position | undefined)[] = [];
          ch.steps.forEach((step, si) => {
            const ctx = { anchors };
            let prog: StepProgress = initProgress(step.spec, ctx);
            if (step.spec.type === 'choice') {
              const idx = step.spec.options.indexOf(step.spec.answer);
              expect(idx).toBeGreaterThanOrEqual(0);
              expect(step.spec.options.length).toBe(4);
              expect(evaluateChoice(step.spec, prog, idx).complete).toBe(true);
              anchors[si] = undefined;
              return;
            }
            // every position must stay inside the visible neck
            const solution = autoSolve(step.spec, prog, ctx, 3);
            let done = false;
            for (const p of solution) {
              expect(p.fret).toBeLessThanOrEqual(ch.fretMax);
              const r = evaluateClick(step.spec, prog, p, ctx);
              expect(r.outcome).toBe('correct');
              prog = r.progress;
              done = r.complete;
            }
            expect(done, `${ch.kind} step ${si} unsolved`).toBe(true);
            anchors[si] = stepAnchor(prog);
          });
        }
        expect(kinds.size).toBeGreaterThan(0);
      });
    }
  }
});
