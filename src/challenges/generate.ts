import { levelDef, type StageId } from '../progression/stages';
import { pickConcept, type SrsState } from '../srs/srs';
import type { Rng } from '../util/rng';
import { chordCandidates, CHORD_KINDS } from './chordsStage';
import { intervalCandidates, INTERVAL_KINDS } from './intervalsStage';
import { NOTE_KINDS, noteCandidates } from './notesStage';
import type { Challenge } from './types';
import { buildFromKinds, type GenCtx, type KindDef } from './util';

export interface GenerateInput {
  stage: StageId;
  level: number;
  srs: SrsState;
  rng: Rng;
  id: number;
  recentKinds: string[];
  /** Concepts used by the previous challenge (avoided when possible). */
  avoidConcepts?: string[];
}

function run<C>(
  input: GenerateInput,
  kinds: KindDef<C>[],
  candidates: { key: string; concept: C }[],
): Challenge | null {
  const lv = levelDef(input.level);
  const ctx: GenCtx = { id: input.id, level: input.level, lv, rng: input.rng, srs: input.srs, recentKinds: input.recentKinds };
  let pool = candidates;
  const filtered = pool.filter((c) => !input.avoidConcepts?.includes(c.key));
  if (filtered.length > 0) pool = filtered;
  while (pool.length) {
    const key = pickConcept(input.srs, pool.map((c) => c.key), input.rng);
    const cand = pool.find((c) => c.key === key)!;
    const res = buildFromKinds(ctx, kinds, cand.concept);
    if (res) {
      const { kind, built } = res;
      let timeLimitMs: number | undefined;
      if (kind.timeCapable && lv.timedChance > 0 && input.rng() < lv.timedChance) {
        timeLimitMs = Math.round(lv.baseTimeMs * (0.7 + 0.45 * built.clicks) * (kind.timeFactor ?? 1));
      }
      return {
        id: input.id,
        stage: input.stage,
        kind: kind.id,
        flavor: timeLimitMs ? 'velocidad' : kind.flavor,
        concepts: built.concepts,
        fretMax: lv.fretMax,
        steps: built.steps,
        timeLimitMs,
      };
    }
    pool = pool.filter((c) => c.key !== key);
  }
  return null;
}

export function generateChallenge(input: GenerateInput): Challenge {
  let ch: Challenge | null = null;
  if (input.stage === 'notes') ch = run(input, NOTE_KINDS, noteCandidates(input.level));
  else if (input.stage === 'intervals') ch = run(input, INTERVAL_KINDS, intervalCandidates(input.level));
  else ch = run(input, CHORD_KINDS, chordCandidates(input.level));
  if (!ch) throw new Error(`No se pudo generar un desafío para ${input.stage} nivel ${input.level}`);
  return ch;
}
