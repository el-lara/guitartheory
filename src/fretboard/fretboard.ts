import { midiToPc, noteName, type PitchClass } from '../theory';

export interface StringDef {
  label: string;
  /** MIDI number of the open string. */
  midi: number;
}

/** Index 0 is the lowest string (6ª), index 5 the highest (1ª). */
export interface Tuning {
  name: string;
  strings: StringDef[];
}

export const STANDARD_TUNING: Tuning = {
  name: 'Estándar',
  strings: [
    { label: 'E', midi: 40 },
    { label: 'A', midi: 45 },
    { label: 'D', midi: 50 },
    { label: 'G', midi: 55 },
    { label: 'B', midi: 59 },
    { label: 'E', midi: 64 },
  ],
};

export interface Position {
  /** String index, 0 = 6ª (lowest). */
  string: number;
  fret: number;
}

export interface Region {
  fretMin: number;
  fretMax: number;
  /** Restrict to these string indexes. */
  strings?: number[];
}

export const MAX_FRET = 12;

export const stringNumber = (stringIndex: number, tuning: Tuning = STANDARD_TUNING): number =>
  tuning.strings.length - stringIndex;

export const stringOrdinal = (stringIndex: number, tuning: Tuning = STANDARD_TUNING): string =>
  `${stringNumber(stringIndex, tuning)}ª`;

export const samePos = (a: Position, b: Position): boolean => a.string === b.string && a.fret === b.fret;
export const posKey = (p: Position): string => `${p.string}:${p.fret}`;

export const positionMidi = (p: Position, tuning: Tuning = STANDARD_TUNING): number =>
  tuning.strings[p.string].midi + p.fret;

export const positionPc = (p: Position, tuning: Tuning = STANDARD_TUNING): PitchClass =>
  midiToPc(positionMidi(p, tuning));

export const positionNote = (p: Position, tuning: Tuning = STANDARD_TUNING): string =>
  noteName(positionPc(p, tuning));

export const inRegion = (p: Position, r: Region): boolean =>
  p.fret >= r.fretMin && p.fret <= r.fretMax && (!r.strings || r.strings.includes(p.string));

export function regionPositions(r: Region, tuning: Tuning = STANDARD_TUNING): Position[] {
  const out: Position[] = [];
  for (let s = 0; s < tuning.strings.length; s++) {
    if (r.strings && !r.strings.includes(s)) continue;
    for (let f = r.fretMin; f <= r.fretMax; f++) out.push({ string: s, fret: f });
  }
  return out;
}

/** Every position in the region where the given pitch class sounds. */
export const positionsOfPc = (pc: PitchClass, r: Region, tuning: Tuning = STANDARD_TUNING): Position[] =>
  regionPositions(r, tuning).filter((p) => positionPc(p, tuning) === pc);

/** Human description of how to get from `a` to `b` on the neck. */
export function describeShape(a: Position, b: Position): string {
  const ds = b.string - a.string;
  const df = b.fret - a.fret;
  const fr = df === 0 ? 'mismo traste' : `${df > 0 ? '+' : '−'}${Math.abs(df)} ${Math.abs(df) === 1 ? 'traste' : 'trastes'}`;
  if (ds === 0) return `misma cuerda, ${fr}`;
  const n = Math.abs(ds);
  const st = `${n} ${n === 1 ? 'cuerda' : 'cuerdas'} ${ds > 0 ? 'más aguda' : 'más grave'}${n === 1 ? '' : 's'}`;
  return `${st}, ${fr}`;
}
