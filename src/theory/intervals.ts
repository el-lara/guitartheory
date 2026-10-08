import { mod12, type PitchClass } from './notes';

export interface IntervalDef {
  semitones: number;
  /** Lowercase Spanish name, e.g. "quinta justa". */
  name: string;
  article: 'un' | 'una';
}

export const INTERVALS: IntervalDef[] = [
  { semitones: 0, name: 'unísono', article: 'un' },
  { semitones: 1, name: 'segunda menor', article: 'una' },
  { semitones: 2, name: 'segunda mayor', article: 'una' },
  { semitones: 3, name: 'tercera menor', article: 'una' },
  { semitones: 4, name: 'tercera mayor', article: 'una' },
  { semitones: 5, name: 'cuarta justa', article: 'una' },
  { semitones: 6, name: 'tritono', article: 'un' },
  { semitones: 7, name: 'quinta justa', article: 'una' },
  { semitones: 8, name: 'sexta menor', article: 'una' },
  { semitones: 9, name: 'sexta mayor', article: 'una' },
  { semitones: 10, name: 'séptima menor', article: 'una' },
  { semitones: 11, name: 'séptima mayor', article: 'una' },
  { semitones: 12, name: 'octava', article: 'una' },
];

export function intervalDef(semitones: number): IntervalDef {
  const d = INTERVALS[semitones];
  if (!d) throw new Error(`Intervalo fuera de rango: ${semitones}`);
  return d;
}

/** "quinta justa" */
export const intervalName = (semitones: number): string => intervalDef(semitones).name;

/** "una quinta justa" */
export const intervalWithArticle = (semitones: number): string => {
  const d = intervalDef(semitones);
  return `${d.article} ${d.name}`;
};

/** Ascending distance in semitones between two pitch classes, 0..11. */
export const ascendingDistance = (from: PitchClass, to: PitchClass): number => mod12(to - from);
