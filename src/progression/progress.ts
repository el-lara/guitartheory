import type { Outcome } from '../srs/srs';
import { MAX_LEVEL, STAGES, type StageId } from './stages';

export interface StageProgress {
  level: number;
  /** Rolling window of the most recent outcomes at the current level. */
  recent: Outcome[];
}

export type Progress = Record<StageId, StageProgress>;

export const emptyProgress = (): Progress => ({
  notes: { level: 1, recent: [] },
  intervals: { level: 1, recent: [] },
  chords: { level: 1, recent: [] },
});

const WINDOW = 8;
const SCORE: Record<Outcome, number> = { perfect: 1, ok: 0.5, fail: 0 };

export type LevelChange = 'up' | 'down' | null;

/** Level goes up with sustained clean play and down with sustained failure. Pure. */
export function applyOutcome(p: Progress, stage: StageId, outcome: Outcome): { progress: Progress; change: LevelChange } {
  const cur = p[stage];
  const recent = [...cur.recent, outcome].slice(-WINDOW);
  const avg = recent.reduce((a, o) => a + SCORE[o], 0) / recent.length;
  const fails = recent.filter((o) => o === 'fail').length;
  let level = cur.level;
  let change: LevelChange = null;
  let window = recent;
  if (recent.length >= WINDOW && avg >= 0.8 && fails <= 1 && level < MAX_LEVEL) {
    level++;
    change = 'up';
    window = [];
  } else if (recent.length >= 6 && fails / recent.length >= 0.5 && level > 1) {
    level--;
    change = 'down';
    window = [];
  }
  return { progress: { ...p, [stage]: { level, recent: window } }, change };
}

export function isUnlocked(p: Progress, stage: StageId, unlockAll = false): boolean {
  if (unlockAll) return true;
  const req = STAGES.find((s) => s.id === stage)?.requires;
  return !req || p[req.stage].level >= req.level;
}
