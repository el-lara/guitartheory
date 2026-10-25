import { describe, expect, it } from 'vitest';
import { midiFreq } from '../theory';
import { positionMidi, STANDARD_TUNING } from './fretboard';
import { describeDelta, makeTuning, TUNING_PRESETS } from './tunings';

const preset = (id: string) => TUNING_PRESETS.find((p) => p.id === id)!;
const labels = (id: string, shift: number) => makeTuning(preset(id), shift).strings.map((s) => s.label);

describe('tunings', () => {
  it('standard is E A D G B E and shifting moves every string', () => {
    expect(labels('standard', 0)).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
    expect(labels('standard', -1)).toEqual(['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb']);
    expect(labels('standard', -2)).toEqual(['D', 'G', 'C', 'F', 'A', 'D']);
    expect(labels('standard', -4)).toEqual(['C', 'F', 'Bb', 'Eb', 'G', 'C']);
    expect(labels('standard', 1)).toEqual(['F', 'A#', 'D#', 'G#', 'C', 'F']);
    const down = makeTuning(preset('standard'), -1);
    down.strings.forEach((s, i) => expect(s.midi).toBe(STANDARD_TUNING.strings[i].midi - 1));
  });
  it('alternate tunings', () => {
    expect(labels('dropD', 0)).toEqual(['D', 'A', 'D', 'G', 'B', 'E']);
    expect(labels('dadgad', 0)).toEqual(['D', 'A', 'D', 'G', 'A', 'D']);
    expect(labels('openG', 0)).toEqual(['D', 'G', 'D', 'G', 'B', 'D']);
    expect(labels('openD', 0)).toEqual(['D', 'A', 'D', 'F#', 'A', 'D']);
    expect(labels('dropD', -2)).toEqual(['C', 'G', 'C', 'F', 'A', 'D']);
  });
  it('frets follow the tuning', () => {
    const t = makeTuning(preset('standard'), -2);
    expect(positionMidi({ string: 0, fret: 2 }, t)).toBe(STANDARD_TUNING.strings[0].midi); // 2nd fret of D-tuned 6th = E
  });
  it('frequencies and wording', () => {
    expect(midiFreq(69)).toBeCloseTo(440, 5);
    expect(midiFreq(40)).toBeCloseTo(82.41, 2); // low E
    expect(midiFreq(64)).toBeCloseTo(329.63, 2); // high E
    expect(describeDelta(-1)).toBe('medio tono abajo');
    expect(describeDelta(-2)).toBe('un tono abajo');
    expect(describeDelta(2)).toBe('un tono arriba');
    expect(describeDelta(0)).toBe('igual');
  });
});
