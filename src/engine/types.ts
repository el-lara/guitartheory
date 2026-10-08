import type { Position, Region } from '../fretboard/fretboard';
import type { ChordQuality, PitchClass } from '../theory';

/** Where an interval step starts from. */
export type OriginSpec =
  | { kind: 'pick'; pc: PitchClass } // user must first click a note with this pitch class
  | { kind: 'fixed'; pos: Position } // origin is shown on the board
  | { kind: 'ref'; step: number }; // origin is the position found in an earlier step

export interface NoteSpec {
  type: 'note';
  pc: PitchClass;
  /** Distinct positions the user must find. */
  need: number;
  region: Region;
  exclude?: Position[];
  /** If set, only these positions count (they leave room for the next step). */
  allowed?: Position[];
}

export interface IntervalSpec {
  type: 'interval';
  /** Ascending distance in semitones (exact, octave included). */
  semitones: number;
  origin: OriginSpec;
  /** Distinct target positions required. */
  need: number;
  region: Region;
}

export interface ChordSpec {
  type: 'chord';
  root: PitchClass;
  quality: ChordQuality;
  region: Region;
  /** Root must be played on this string index. */
  rootString?: number;
  /** Pre-placed, immovable notes. */
  locked: Position[];
}

export interface ChoiceSpec {
  type: 'choice';
  /** Interval sizes (semitones) offered as options. */
  options: number[];
  answer: number;
  /** Two marked positions the question is about. */
  marks: [Position, Position];
}

export type StepSpec = NoteSpec | IntervalSpec | ChordSpec | ChoiceSpec;

export type StepProgress =
  | { type: 'note'; found: Position[] }
  | { type: 'interval'; origin?: Position; targets: Position[] }
  | { type: 'chord'; selected: Position[] }
  | { type: 'choice'; picked?: number };

export interface EvalContext {
  /** Anchor position of every already-completed step (first found/target). */
  anchors: (Position | undefined)[];
}

export type ClickOutcome = 'correct' | 'wrong' | 'info' | 'ignored';

export interface ClickResult {
  outcome: ClickOutcome;
  complete: boolean;
  progress: StepProgress;
  message: string;
}
