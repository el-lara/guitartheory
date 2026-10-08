import { transpose, type PitchClass } from './notes';

export interface ScaleInfo {
  name: string;
  /** Semitones above the tonic. */
  intervals: number[];
  /** Degree labels matching `intervals`. */
  degrees: string[];
}

/** Add new scales (modes, harmonic minor...) here — lessons and future stages read this table. */
export const SCALES = {
  major: { name: 'Mayor', intervals: [0, 2, 4, 5, 7, 9, 11], degrees: ['1', '2', '3', '4', '5', '6', '7'] },
  naturalMinor: { name: 'Menor natural', intervals: [0, 2, 3, 5, 7, 8, 10], degrees: ['1', '2', '♭3', '4', '5', '♭6', '♭7'] },
  pentatonicMajor: { name: 'Pentatónica mayor', intervals: [0, 2, 4, 7, 9], degrees: ['1', '2', '3', '5', '6'] },
  pentatonicMinor: { name: 'Pentatónica menor', intervals: [0, 3, 5, 7, 10], degrees: ['1', '♭3', '4', '5', '♭7'] },
  blues: { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10], degrees: ['1', '♭3', '4', '♭5', '5', '♭7'] },
} satisfies Record<string, ScaleInfo>;

export type ScaleType = keyof typeof SCALES;
export const SCALE_TYPES = Object.keys(SCALES) as ScaleType[];

export const scalePcs = (tonic: PitchClass, type: ScaleType): PitchClass[] =>
  SCALES[type].intervals.map((i) => transpose(tonic, i));

/** Distances between consecutive scale degrees, closing back to the octave: major = 2 2 1 2 2 2 1. */
export function scaleSteps(type: ScaleType): number[] {
  const iv = SCALES[type].intervals;
  return iv.map((v, i) => (i + 1 < iv.length ? iv[i + 1] : 12) - v);
}

/** Key signature of the major key whose tonic sits at `fifths` steps clockwise from C on the circle of fifths. */
export function keySignature(fifths: number): { kind: 'sharps' | 'flats' | 'none'; count: number; notes: string[] } {
  const k = ((fifths % 12) + 12) % 12;
  const SHARPS = ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'];
  const FLATS = ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'];
  if (k === 0) return { kind: 'none', count: 0, notes: [] };
  if (k <= 6) return { kind: 'sharps', count: k, notes: SHARPS.slice(0, k) };
  return { kind: 'flats', count: 12 - k, notes: FLATS.slice(0, 12 - k) };
}

/** Pitch class found `k` steps clockwise on the circle of fifths (each step = +7 semitones). */
export const fifthsPc = (k: number): PitchClass => (((k * 7) % 12) + 12) % 12;
