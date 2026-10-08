/** Pitch class: 0 = C ... 11 = B. Everything in the theory engine is modulo-12 arithmetic. */
export type PitchClass = number;

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const NATURAL_PCS: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

export const noteName = (pc: PitchClass): string => NOTE_NAMES[mod12(pc)];

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Parses "C", "F#", "Bb", "Ebb"... into a pitch class. */
export function parseNote(name: string): PitchClass {
  const m = /^([A-Ga-g])([#b]*)$/.exec(name.trim());
  if (!m) throw new Error(`Nota inválida: ${name}`);
  let pc = LETTER[m[1].toUpperCase()];
  for (const c of m[2]) pc += c === '#' ? 1 : -1;
  return mod12(pc);
}

export const transpose = (pc: PitchClass, semitones: number): PitchClass => mod12(pc + semitones);

export const midiToPc = (midi: number): PitchClass => mod12(midi);

/** Scientific pitch name, C4 = MIDI 60. */
export const midiName = (midi: number): string => `${noteName(midi)}${Math.floor(midi / 12) - 1}`;
