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

export interface LibraryChord {
  name: string;
  /** Suffix used in chord symbols: "", "m", "7", "maj7"... */
  suffix: string;
  intervals: number[];
  degrees: string[];
  /** 4-note chords may leave out the fifth (standard on guitar). */
  optionalFifth?: boolean;
}

/**
 * Chords offered by the chord library page. The game itself only uses `CHORD_FORMULAS`
 * (major/minor), so adding qualities here never changes the training pool.
 */
export const CHORD_LIBRARY = {
  maj: { name: 'Mayor', suffix: '', intervals: [0, 4, 7], degrees: ['1', '3', '5'] },
  min: { name: 'Menor', suffix: 'm', intervals: [0, 3, 7], degrees: ['1', '♭3', '5'] },
  dom7: { name: 'Séptima dominante', suffix: '7', intervals: [0, 4, 7, 10], degrees: ['1', '3', '5', '♭7'], optionalFifth: true },
  maj7: { name: 'Séptima mayor', suffix: 'maj7', intervals: [0, 4, 7, 11], degrees: ['1', '3', '5', '7'], optionalFifth: true },
  min7: { name: 'Menor séptima', suffix: 'm7', intervals: [0, 3, 7, 10], degrees: ['1', '♭3', '5', '♭7'], optionalFifth: true },
  sus2: { name: 'Suspendido 2', suffix: 'sus2', intervals: [0, 2, 7], degrees: ['1', '2', '5'] },
  sus4: { name: 'Suspendido 4', suffix: 'sus4', intervals: [0, 5, 7], degrees: ['1', '4', '5'] },
  dim: { name: 'Disminuido', suffix: 'dim', intervals: [0, 3, 6], degrees: ['1', '♭3', '♭5'] },
  aug: { name: 'Aumentado', suffix: 'aug', intervals: [0, 4, 8], degrees: ['1', '3', '♯5'] },
  m7b5: { name: 'Semidisminuido', suffix: 'm7♭5', intervals: [0, 3, 6, 10], degrees: ['1', '♭3', '♭5', '♭7'] },
  dim7: { name: 'Disminuido 7', suffix: 'dim7', intervals: [0, 3, 6, 9], degrees: ['1', '♭3', '♭5', '♭♭7'] },
} satisfies Record<string, LibraryChord>;

export type LibraryQuality = keyof typeof CHORD_LIBRARY;
export const LIBRARY_QUALITIES = Object.keys(CHORD_LIBRARY) as LibraryQuality[];

export const libraryPcs = (root: PitchClass, q: LibraryQuality): PitchClass[] =>
  CHORD_LIBRARY[q].intervals.map((i) => transpose(root, i));

/** "C", "Am", "G7", "Fmaj7"... */
export const chordSymbol = (root: PitchClass, q: LibraryQuality): string => `${noteName(root)}${CHORD_LIBRARY[q].suffix}`;

export const libraryChordName = (root: PitchClass, q: LibraryQuality): string =>
  `${noteName(root)} ${CHORD_LIBRARY[q].name.toLowerCase()}`;
