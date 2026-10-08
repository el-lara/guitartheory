import {
  positionMidi,
  positionsOfPc,
  type Position,
  type Region,
} from '../fretboard/fretboard';
import { handSpan, MAX_HAND_SPAN } from '../engine/evaluator';
import { chordPcs, type ChordQuality, type PitchClass } from '../theory';
import type { LevelDef } from '../progression/stages';
import { weightedPick, type Rng } from '../util/rng';
import type { Flavor, StepDef } from './types';
import type { SrsState } from '../srs/srs';

export interface GenCtx {
  id: number;
  level: number;
  lv: LevelDef;
  rng: Rng;
  srs: SrsState;
  recentKinds: string[];
}

export interface Built {
  steps: StepDef[];
  /** Estimated number of clicks, used to size the timer. */
  clicks: number;
  concepts: string[];
}

export interface KindDef<C> {
  id: string;
  minLevel: number;
  weight: number;
  flavor: Flavor;
  timeCapable?: boolean;
  timeFactor?: number;
  build: (ctx: GenCtx, concept: C) => Built | null;
}

export const fullRegion = (lv: LevelDef): Region => ({ fretMin: 0, fretMax: lv.fretMax });

/** Positions inside `region` that sound exactly `semitones` above `origin`. */
export function targetsFrom(origin: Position, semitones: number, region: Region, strings = 6): Position[] {
  const midi = positionMidi(origin);
  const out: Position[] = [];
  for (let s = 0; s < strings; s++) {
    for (let f = region.fretMin; f <= region.fretMax; f++) {
      const p = { string: s, fret: f };
      if (positionMidi(p) === midi + semitones && (!region.strings || region.strings.includes(s))) out.push(p);
    }
  }
  return out;
}

/** Origins (of pitch class `pc`) in `region` that have at least `need` targets `semitones` above. */
export function originsWithTargets(pc: PitchClass, semitones: number, region: Region, need = 1): Position[] {
  return positionsOfPc(pc, region).filter((o) => targetsFrom(o, semitones, region).length >= need);
}

/** All playable shapes of a triad: one note per pitch class, distinct strings, hand-sized. */
export function findVoicings(
  root: PitchClass,
  quality: ChordQuality,
  region: Region,
  opts: { rootString?: number } = {},
): Position[][] {
  const [r, ...others] = chordPcs(root, quality);
  const rootPos = positionsOfPc(r, region).filter((p) => opts.rootString === undefined || p.string === opts.rootString);
  const lists = others.map((pc) => positionsOfPc(pc, region));
  const out: Position[][] = [];
  const rec = (i: number, acc: Position[]) => {
    if (i === lists.length) {
      if (handSpan(acc) <= MAX_HAND_SPAN) out.push(acc);
      return;
    }
    for (const p of lists[i]) {
      if (acc.some((q) => q.string === p.string)) continue;
      rec(i + 1, [...acc, p]);
    }
  };
  for (const rp of rootPos) rec(0, [rp]);
  return out;
}

/** Draws kinds by weight (recently used ones are discouraged) until one builds. */
export function buildFromKinds<C>(
  ctx: GenCtx,
  kinds: KindDef<C>[],
  concept: C,
): { kind: KindDef<C>; built: Built } | null {
  let pool = kinds.filter((k) => k.minLevel <= ctx.level);
  while (pool.length) {
    const k = weightedPick(ctx.rng, pool, (x) => {
      const recent = ctx.recentKinds.slice(-2);
      return x.weight * (recent.includes(x.id) ? 0.25 : 1);
    });
    const built = k.build(ctx, concept);
    if (built) return { kind: k, built };
    pool = pool.filter((x) => x !== k);
  }
  return null;
}
