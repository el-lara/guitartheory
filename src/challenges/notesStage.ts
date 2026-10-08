import {
  positionsOfPc,
  stringOrdinal,
  type Position,
  type Region,
} from '../fretboard/fretboard';
import { noteName, type PitchClass } from '../theory';
import { notePool } from '../progression/stages';
import { pick, randInt } from '../util/rng';
import type { StepDef } from './types';
import { fullRegion, originsWithTargets, type KindDef } from './util';

const note = (pc: PitchClass, region: Region, need = 1, extra: Partial<{ exclude: Position[]; allowed: Position[] }> = {}) =>
  ({ type: 'note' as const, pc, need, region, ...extra });

const nk = (pc: PitchClass) => `note:${noteName(pc)}`;

export const NOTE_KINDS: KindDef<PitchClass>[] = [
  {
    id: 'find-one',
    minLevel: 1,
    weight: 3,
    flavor: 'precisión',
    timeCapable: true,
    build: (ctx, pc) => ({
      steps: [{ prompt: `Encuentra ${noteName(pc)}`, spec: note(pc, fullRegion(ctx.lv)) }],
      clicks: 1,
      concepts: [nk(pc)],
    }),
  },
  {
    id: 'find-n',
    minLevel: 1,
    weight: 2,
    flavor: 'exploración',
    timeCapable: true,
    build: (ctx, pc) => {
      const total = positionsOfPc(pc, fullRegion(ctx.lv)).length;
      if (total < 2) return null;
      const n = randInt(ctx.rng, 2, Math.min(4, total));
      return {
        steps: [{ prompt: `Encuentra ${n} ${noteName(pc)}`, sub: 'en posiciones distintas', spec: note(pc, fullRegion(ctx.lv), n) }],
        clicks: n,
        concepts: [nk(pc)],
      };
    },
  },
  {
    id: 'find-all',
    minLevel: 1,
    weight: 1.2,
    flavor: 'exploración',
    build: (ctx, pc) => {
      const total = positionsOfPc(pc, fullRegion(ctx.lv)).length;
      if (total < 2 || total > 7) return null;
      return {
        steps: [{ prompt: `Encuentra todos los ${noteName(pc)}`, sub: `${total} en total`, spec: note(pc, fullRegion(ctx.lv), total) }],
        clicks: total,
        concepts: [nk(pc)],
      };
    },
  },
  {
    id: 'on-string',
    minLevel: 1,
    weight: 2,
    flavor: 'precisión',
    timeCapable: true,
    build: (ctx, pc) => {
      const strings = [0, 1, 2, 3, 4, 5].filter((s) => positionsOfPc(pc, { ...fullRegion(ctx.lv), strings: [s] }).length > 0);
      if (!strings.length) return null;
      const s = pick(ctx.rng, strings);
      return {
        steps: [{ prompt: `Encuentra un ${noteName(pc)} en la ${stringOrdinal(s)} cuerda`, spec: note(pc, { ...fullRegion(ctx.lv), strings: [s] }) }],
        clicks: 1,
        concepts: [nk(pc)],
      };
    },
  },
  {
    id: 'in-region',
    minLevel: 2,
    weight: 2,
    flavor: 'exploración',
    timeCapable: true,
    build: (ctx, pc) => {
      const w = ctx.level <= 2 ? 3 : 4;
      for (let i = 0; i < 8; i++) {
        const a = randInt(ctx.rng, 0, ctx.lv.fretMax - w);
        const region = { fretMin: a, fretMax: a + w };
        if (positionsOfPc(pc, region).length === 0) continue;
        return {
          steps: [{ prompt: `Encuentra un ${noteName(pc)} entre los trastes ${a} y ${a + w}`, spec: note(pc, region) }],
          clicks: 1,
          concepts: [nk(pc)],
        };
      }
      return null;
    },
  },
  {
    id: 'consecutive',
    minLevel: 2,
    weight: 1.6,
    flavor: 'precisión',
    timeCapable: true,
    build: (ctx, pc) => {
      const pool = notePool(ctx.level);
      const next = pick(ctx.rng, [1, 2, -1, -2]);
      const pc2 = (pc + next + 12) % 12;
      if (!pool.includes(pc2)) return null;
      const r = fullRegion(ctx.lv);
      return {
        steps: [
          { prompt: `Encuentra ${noteName(pc)}`, sub: `y luego ${noteName(pc2)}`, spec: note(pc, r) },
          { prompt: `Ahora ${noteName(pc2)}`, spec: note(pc2, r) },
        ],
        clicks: 2,
        concepts: [nk(pc), nk(pc2)],
      };
    },
  },
  {
    id: 'octave-chain',
    minLevel: 2,
    weight: 1.6,
    flavor: 'exploración',
    timeCapable: true,
    build: (ctx, pc) => {
      const r = fullRegion(ctx.lv);
      const allowed = originsWithTargets(pc, 12, r);
      if (!allowed.length) return null;
      return {
        steps: [
          { prompt: `Encuentra ${noteName(pc)}`, sub: 'y luego su octava', spec: note(pc, r, 1, { allowed }) },
          { prompt: 'Ahora su octava', sub: `otro ${noteName(pc)}, 12 semitonos más agudo`, spec: { type: 'interval', semitones: 12, origin: { kind: 'ref', step: 0 }, need: 1, region: r } },
        ],
        clicks: 2,
        concepts: [nk(pc)],
      };
    },
  },
  {
    id: 'octave-marked',
    minLevel: 2,
    weight: 1.2,
    flavor: 'reconocimiento',
    build: (ctx, pc) => {
      const r = fullRegion(ctx.lv);
      const origins = originsWithTargets(pc, 12, r);
      if (!origins.length) return null;
      const origin = pick(ctx.rng, origins);
      return {
        steps: [{ prompt: `Esta es ${noteName(pc)}. Encuentra su octava`, spec: { type: 'interval', semitones: 12, origin: { kind: 'fixed', pos: origin }, need: 1, region: r } }],
        clicks: 1,
        concepts: [nk(pc)],
      };
    },
  },
  {
    id: 'memory',
    minLevel: 2,
    weight: 1.4,
    flavor: 'memoria',
    build: (ctx, pc) => {
      const r = fullRegion(ctx.lv);
      const all = positionsOfPc(pc, r);
      if (all.length < 2) return null;
      const shown = pick(ctx.rng, all);
      const ms = ctx.level <= 3 ? 2200 : 1600;
      const step: StepDef = {
        prompt: 'Encuentra esa misma nota en otra posición',
        reveal: { positions: [shown], ms, prompt: 'Memoriza esta nota…' },
        spec: note(pc, r, 1, { exclude: [shown] }),
      };
      return { steps: [step], clicks: 1, concepts: [nk(pc)] };
    },
  },
];

export const noteCandidates = (level: number) => notePool(level).map((pc) => ({ key: nk(pc), concept: pc }));
