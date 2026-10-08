import { weightedPick, type Rng } from '../util/rng';

/** How a challenge ended. */
export type Outcome = 'perfect' | 'ok' | 'fail';

export interface ConceptRecord {
  attempts: number;
  misses: number;
  /** Consecutive clean successes. */
  streak: number;
  /** 0..1 exponential moving average of recent outcomes. */
  mastery: number;
  /** Global challenge counter when last seen. */
  lastTick: number;
  lastResult: Outcome;
  lastSeenAt: number;
}

export interface SrsState {
  /** Counts challenges played across all sessions; the "clock" of the repetition system. */
  tick: number;
  records: Record<string, ConceptRecord>;
}

export const emptySrs = (): SrsState => ({ tick: 0, records: {} });

/** Unseen concepts start low so they get introduced, but not as urgent as a failed one. */
const INITIAL_MASTERY = 0.35;
const OUTCOME_VALUE: Record<Outcome, number> = { perfect: 1, ok: 0.55, fail: 0 };

export const masteryOf = (s: SrsState, key: string): number => s.records[key]?.mastery ?? INITIAL_MASTERY;

/** Challenges to wait before a concept is "due" again: grows with consecutive clean successes. */
export const gapFor = (streak: number): number => (streak <= 0 ? 2 : Math.min(40, 3 * 2 ** (streak - 1)));

/** Registers the result of one challenge for the concepts it exercised. Pure. */
export function recordResult(s: SrsState, keys: string[], outcome: Outcome, now = Date.now()): SrsState {
  const tick = s.tick + 1;
  const records = { ...s.records };
  for (const key of keys) {
    const prev = records[key];
    const mastery = prev ? prev.mastery * 0.65 + OUTCOME_VALUE[outcome] * 0.35 : INITIAL_MASTERY * 0.5 + OUTCOME_VALUE[outcome] * 0.5;
    records[key] = {
      attempts: (prev?.attempts ?? 0) + 1,
      misses: (prev?.misses ?? 0) + (outcome === 'perfect' ? 0 : 1),
      streak: outcome === 'perfect' ? (prev?.streak ?? 0) + 1 : 0,
      mastery,
      lastTick: tick,
      lastResult: outcome,
      lastSeenAt: now,
    };
  }
  return { tick, records };
}

/**
 * Selection weight of a concept. Weak concepts weigh more, concepts that are "due"
 * (waited longer than their gap) weigh more, and a just-failed concept comes back soon.
 */
export function conceptWeight(s: SrsState, key: string): number {
  const r = s.records[key];
  if (!r) return 1.6; // never seen: introduce
  const weakness = (1 - r.mastery) ** 2;
  const waited = s.tick - r.lastTick;
  const gap = gapFor(r.streak);
  const due = waited >= gap ? Math.min(2, (waited - gap) / gap + 0.5) : 0;
  const retry = r.lastResult !== 'perfect' && waited >= 2 ? 1.5 : 0;
  const tooSoon = waited < 2 ? 0.15 : 1; // never twice in a row
  return (0.12 + weakness * 2.2 + due + retry) * tooSoon;
}

export function pickConcept(s: SrsState, candidates: string[], rng: Rng): string {
  return weightedPick(rng, candidates, (k) => conceptWeight(s, k));
}

/** Average weakness 0..1 across concepts (for choosing which stage to practice). */
export function averageWeakness(s: SrsState, keys: string[]): number {
  if (keys.length === 0) return 0;
  return keys.reduce((a, k) => a + (1 - masteryOf(s, k)), 0) / keys.length;
}
