import { transpose, type PitchClass } from './notes';

/** Scale formulas as semitone offsets from the tonic. Used by future stages (4: escalas). */
export const SCALE_FORMULAS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
} as const;

export type ScaleType = keyof typeof SCALE_FORMULAS;

export const scalePcs = (tonic: PitchClass, type: ScaleType): PitchClass[] =>
  SCALE_FORMULAS[type].map((i) => transpose(tonic, i));
