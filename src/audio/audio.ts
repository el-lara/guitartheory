/**
 * Audio seam. The MVP ships silent (`NoAudio`); a future WebAudio/sample engine only has to
 * implement this interface. Everything is expressed in MIDI numbers, which the fretboard
 * model already produces via `positionMidi`.
 */
export interface AudioEngine {
  playNote(midi: number): void;
  /** Melodic (sequential) or harmonic (together) interval. */
  playInterval(fromMidi: number, toMidi: number, mode: 'melodic' | 'harmonic'): void;
  playChord(midis: number[], strum?: boolean): void;
}

export const NoAudio: AudioEngine = {
  playNote() {},
  playInterval() {},
  playChord() {},
};
