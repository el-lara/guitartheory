import { noteName, noteNameFlat } from '../theory';
import { STANDARD_TUNING, type Tuning } from './fretboard';

export interface TuningPreset {
  id: string;
  name: string;
  /** MIDI of the open strings, 6ª first. */
  midis: number[];
}

/** Base shapes; any of them can then be shifted down or up in semitones. */
export const TUNING_PRESETS: TuningPreset[] = [
  { id: 'standard', name: 'Estándar', midis: STANDARD_TUNING.strings.map((s) => s.midi) }, // E A D G B E
  { id: 'dropD', name: 'Drop D', midis: [38, 45, 50, 55, 59, 64] }, // D A D G B E
  { id: 'dadgad', name: 'DADGAD', midis: [38, 45, 50, 55, 57, 62] }, // D A D G A D
  { id: 'openG', name: 'Open G', midis: [38, 43, 50, 55, 59, 62] }, // D G D G B D
  { id: 'openD', name: 'Open D', midis: [38, 45, 50, 54, 57, 62] }, // D A D F# A D
];

export const SHIFTS = [-4, -3, -2, -1, 0, 1, 2] as const;

const SHIFT_NAMES: Record<number, string> = {
  [-4]: 'dos tonos abajo',
  [-3]: 'tono y medio abajo',
  [-2]: 'un tono abajo',
  [-1]: 'medio tono abajo',
  0: 'sin transponer',
  1: 'medio tono arriba',
  2: 'un tono arriba',
};

export const describeShift = (shift: number): string => SHIFT_NAMES[shift] ?? `${shift} semitonos`;

/** Spanish description of a per-string change: "medio tono abajo", "2 semitonos arriba"... */
export function describeDelta(semitones: number): string {
  if (semitones === 0) return 'igual';
  const n = Math.abs(semitones);
  const dir = semitones < 0 ? 'abajo' : 'arriba';
  if (n === 1) return `medio tono ${dir}`;
  if (n === 2) return `un tono ${dir}`;
  if (n === 3) return `tono y medio ${dir}`;
  if (n === 4) return `dos tonos ${dir}`;
  return `${n} semitonos ${dir}`;
}

/** Builds a tuning from a preset moved by `shift` semitones. Downtunings are spelled with flats. */
export function makeTuning(preset: TuningPreset, shift: number): Tuning {
  const spell = shift < 0 ? noteNameFlat : noteName;
  return {
    name: shift === 0 ? preset.name : `${preset.name}, ${describeShift(shift)}`,
    strings: preset.midis.map((m) => ({ midi: m + shift, label: spell(m + shift) })),
  };
}
