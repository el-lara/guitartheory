import { transpose, noteName, type PitchClass } from './notes';

export interface ChordFormula {
  /** Spanish quality name used in titles: "mayor". */
  name: string;
  /** Semitones above the root, root first. */
  intervals: number[];
  /** Scale-degree labels matching `intervals`. */
  degrees: string[];
  /** Short name of the chord family, e.g. "tríada mayor". */
  family: string;
}

/** Add new chord qualities here (dim, aug, 7ths...) — the rest of the app reads this table. */
export const CHORD_FORMULAS = {
  maj: { name: 'mayor', intervals: [0, 4, 7], degrees: ['1', '3', '5'], family: 'tríada mayor' },
  min: { name: 'menor', intervals: [0, 3, 7], degrees: ['1', '♭3', '5'], family: 'tríada menor' },
} satisfies Record<string, ChordFormula>;

export type ChordQuality = keyof typeof CHORD_FORMULAS;
export const CHORD_QUALITIES = Object.keys(CHORD_FORMULAS) as ChordQuality[];

export const chordPcs = (root: PitchClass, q: ChordQuality): PitchClass[] =>
  CHORD_FORMULAS[q].intervals.map((i) => transpose(root, i));

export const chordName = (root: PitchClass, q: ChordQuality): string =>
  `${noteName(root)} ${CHORD_FORMULAS[q].name}`;

/** Chord tone index (0 = root, 1 = third, 2 = fifth) for a pitch class, or -1. */
export const chordToneIndex = (root: PitchClass, q: ChordQuality, pc: PitchClass): number =>
  chordPcs(root, q).indexOf(pc);
