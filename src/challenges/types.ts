import type { Position } from '../fretboard/fretboard';
import type { StepSpec } from '../engine/types';
import type { StageId } from '../progression/stages';

export type Flavor = 'precisión' | 'velocidad' | 'memoria' | 'reconocimiento' | 'construcción' | 'exploración';

export interface StepDef {
  prompt: string;
  /** Smaller line under the prompt. */
  sub?: string;
  spec: StepSpec;
  /** Positions shown (with note names) for `ms`, then hidden. Clicks are blocked meanwhile. */
  reveal?: { positions: Position[]; ms: number; prompt: string };
}

export interface Challenge {
  id: number;
  stage: StageId;
  kind: string;
  flavor: Flavor;
  /** Repetition-system keys exercised by this challenge. */
  concepts: string[];
  /** Highest fret displayed/playable. */
  fretMax: number;
  steps: StepDef[];
  /** Countdown for the whole challenge. */
  timeLimitMs?: number;
}
