import { positionPc, stringOrdinal, type Position } from '../fretboard/fretboard';
import { chordName, chordPcs, noteName, type ChordQuality, type PitchClass } from '../theory';
import { chordPool } from '../progression/stages';
import { pick, randInt, shuffle } from '../util/rng';
import { fullRegion, findVoicings, type KindDef } from './util';

export interface ChordConcept {
  root: PitchClass;
  quality: ChordQuality;
}

const ck = (c: ChordConcept) => `chord:${noteName(c.root)}:${c.quality}`;
const title = (c: ChordConcept) => chordName(c.root, c.quality);
const spec = (c: ChordConcept, region: { fretMin: number; fretMax: number }, extra: { rootString?: number; locked?: Position[] } = {}) =>
  ({ type: 'chord' as const, root: c.root, quality: c.quality, region, locked: extra.locked ?? [], rootString: extra.rootString });

export const CHORD_KINDS: KindDef<ChordConcept>[] = [
  {
    id: 'build',
    minLevel: 1,
    weight: 3,
    flavor: 'construcción',
    timeCapable: true,
    timeFactor: 1.6,
    build: (ctx, c) => {
      const r = fullRegion(ctx.lv);
      if (!findVoicings(c.root, c.quality, r).length) return null;
      return { steps: [{ prompt: `Construye ${title(c)}`, sub: 'toca sus 3 notas', spec: spec(c, r) }], clicks: 3, concepts: [ck(c)] };
    },
  },
  {
    id: 'complete',
    minLevel: 1,
    weight: 2.4,
    flavor: 'reconocimiento',
    build: (ctx, c) => {
      const r = fullRegion(ctx.lv);
      const voicings = findVoicings(c.root, c.quality, r);
      if (!voicings.length) return null;
      const v = pick(ctx.rng, voicings);
      const pcs = chordPcs(c.root, c.quality);
      // hide the third most of the time: it is what makes a chord major or minor
      const hidden = ctx.rng() < 0.6 ? 1 : pick(ctx.rng, [0, 2]);
      const locked = v.filter((p) => positionPc(p) !== pcs[hidden]);
      return { steps: [{ prompt: `Completa ${title(c)}`, sub: 'falta una nota', spec: spec(c, r, { locked }) }], clicks: 1, concepts: [ck(c)] };
    },
  },
  {
    id: 'root-string',
    minLevel: 2,
    weight: 1.6,
    flavor: 'precisión',
    timeCapable: true,
    timeFactor: 1.6,
    build: (ctx, c) => {
      const r = fullRegion(ctx.lv);
      const strings = shuffle(ctx.rng, [0, 1, 2, 3]).filter((s) => findVoicings(c.root, c.quality, r, { rootString: s }).length > 0);
      if (!strings.length) return null;
      const s = strings[0];
      return {
        steps: [{ prompt: `Construye ${title(c)}`, sub: `con la raíz en la ${stringOrdinal(s)} cuerda`, spec: spec(c, r, { rootString: s }) }],
        clicks: 3,
        concepts: [ck(c)],
      };
    },
  },
  {
    id: 'region',
    minLevel: 3,
    weight: 1.4,
    flavor: 'exploración',
    build: (ctx, c) => {
      for (let i = 0; i < 8; i++) {
        const a = randInt(ctx.rng, 0, Math.max(0, ctx.lv.fretMax - 5));
        const region = { fretMin: a, fretMax: a + 5 };
        if (!findVoicings(c.root, c.quality, region).length) continue;
        return {
          steps: [{ prompt: `Construye ${title(c)}`, sub: `entre los trastes ${a} y ${a + 5}`, spec: spec(c, region) }],
          clicks: 3,
          concepts: [ck(c)],
        };
      }
      return null;
    },
  },
  {
    id: 'sequence',
    minLevel: 3,
    weight: 1.6,
    flavor: 'velocidad',
    timeCapable: true,
    timeFactor: 1.5,
    build: (ctx, c) => {
      const r = fullRegion(ctx.lv);
      const others = chordPool(ctx.level).filter((o) => (o.root !== c.root || o.quality !== c.quality) && findVoicings(o.root, o.quality, r).length > 0);
      if (!findVoicings(c.root, c.quality, r).length || !others.length) return null;
      const c2 = pick(ctx.rng, others);
      return {
        steps: [
          { prompt: `Construye ${title(c)}`, sub: `y luego ${title(c2)}`, spec: spec(c, r) },
          { prompt: `Ahora ${title(c2)}`, spec: spec(c2, r) },
        ],
        clicks: 6,
        concepts: [ck(c), ck(c2)],
      };
    },
  },
];

export const chordCandidates = (level: number) => chordPool(level).map((c) => ({ key: ck(c), concept: c }));
