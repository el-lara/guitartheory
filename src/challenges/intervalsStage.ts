import { positionNote, type Position } from '../fretboard/fretboard';
import { intervalName, intervalWithArticle, noteName, type PitchClass } from '../theory';
import { intervalPool, notePool } from '../progression/stages';
import { pick, shuffle } from '../util/rng';
import { fullRegion, originsWithTargets, targetsFrom, type GenCtx, type KindDef } from './util';

const ik = (n: number) => `int:${n}`;

/** Origin pitch classes (from the level's note pool) that can host this interval inside the region. */
function feasibleOrigins(ctx: GenCtx, semitones: number, need = 1): PitchClass[] {
  const r = fullRegion(ctx.lv);
  return notePool(ctx.level).filter((pc) => originsWithTargets(pc, semitones, r, need).length > 0);
}

function randomOriginPos(ctx: GenCtx, semitones: number, need = 1): Position | null {
  const pcs = feasibleOrigins(ctx, semitones, need);
  if (!pcs.length) return null;
  const pc = pick(ctx.rng, pcs);
  return pick(ctx.rng, originsWithTargets(pc, semitones, fullRegion(ctx.lv), need));
}

export const INTERVAL_KINDS: KindDef<number>[] = [
  {
    id: 'pick',
    minLevel: 1,
    weight: 3,
    flavor: 'construcción',
    timeCapable: true,
    timeFactor: 1.3,
    build: (ctx, n) => {
      const pcs = feasibleOrigins(ctx, n);
      if (!pcs.length) return null;
      const pc = pick(ctx.rng, pcs);
      return {
        steps: [{
          prompt: `Encuentra ${intervalWithArticle(n)} desde ${noteName(pc)}`,
          sub: `primero ${noteName(pc)}, luego el destino`,
          spec: { type: 'interval', semitones: n, origin: { kind: 'pick', pc }, need: 1, region: fullRegion(ctx.lv) },
        }],
        clicks: 2,
        concepts: [ik(n)],
      };
    },
  },
  {
    id: 'marked',
    minLevel: 1,
    weight: 2,
    flavor: 'precisión',
    timeCapable: true,
    build: (ctx, n) => {
      const origin = randomOriginPos(ctx, n);
      if (!origin) return null;
      return {
        steps: [{
          prompt: `Desde esta ${positionNote(origin)}, encuentra ${intervalWithArticle(n)}`,
          spec: { type: 'interval', semitones: n, origin: { kind: 'fixed', pos: origin }, need: 1, region: fullRegion(ctx.lv) },
        }],
        clicks: 1,
        concepts: [ik(n)],
      };
    },
  },
  {
    id: 'chain',
    minLevel: 2,
    weight: 2.2,
    flavor: 'velocidad',
    timeCapable: true,
    timeFactor: 1.2,
    build: (ctx, n) => {
      const pcs = feasibleOrigins(ctx, n);
      if (!pcs.length) return null;
      const pc = pick(ctx.rng, pcs);
      const r = fullRegion(ctx.lv);
      const allowed = originsWithTargets(pc, n, r);
      return {
        steps: [
          { prompt: `Encuentra ${noteName(pc)}`, sub: `y luego ${intervalWithArticle(n)} sobre ella`, spec: { type: 'note', pc, need: 1, region: r, allowed } },
          { prompt: `Ahora su ${intervalName(n)}`, spec: { type: 'interval', semitones: n, origin: { kind: 'ref', step: 0 }, need: 1, region: r } },
        ],
        clicks: 2,
        concepts: [ik(n)],
      };
    },
  },
  {
    id: 'multi',
    minLevel: 3,
    weight: 1.4,
    flavor: 'exploración',
    build: (ctx, n) => {
      const origin = randomOriginPos(ctx, n, 2);
      if (!origin) return null;
      return {
        steps: [{
          prompt: `Desde esta ${positionNote(origin)}, encuentra 2 formas de hacer ${intervalWithArticle(n)}`,
          sub: 'posiciones distintas',
          spec: { type: 'interval', semitones: n, origin: { kind: 'fixed', pos: origin }, need: 2, region: fullRegion(ctx.lv) },
        }],
        clicks: 2,
        concepts: [ik(n)],
      };
    },
  },
  {
    id: 'recognize',
    minLevel: 2,
    weight: 1.6,
    flavor: 'reconocimiento',
    build: (ctx, n) => {
      const origin = randomOriginPos(ctx, n);
      if (!origin) return null;
      const target = pick(ctx.rng, targetsFrom(origin, n, fullRegion(ctx.lv)));
      const distractors = shuffle(ctx.rng, intervalPool(ctx.level).filter((x) => x !== n)).slice(0, 3);
      if (distractors.length < 3) return null;
      const options = [n, ...distractors].sort((a, b) => a - b);
      return {
        steps: [{
          prompt: '¿Qué distancia hay entre estas dos notas?',
          sub: 'del punto 1 al 2',
          spec: { type: 'choice', options, answer: n, marks: [origin, target] },
        }],
        clicks: 1,
        concepts: [ik(n)],
      };
    },
  },
];

export const intervalCandidates = (level: number) => intervalPool(level).map((n) => ({ key: ik(n), concept: n }));
