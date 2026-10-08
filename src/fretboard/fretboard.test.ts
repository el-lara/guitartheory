import { describe, expect, it } from 'vitest';
import { parseNote } from '../theory';
import { describeShape, positionNote, positionsOfPc, STANDARD_TUNING } from './fretboard';

describe('fretboard', () => {
  it('open strings are E A D G B E (6ª→1ª)', () => {
    expect(STANDARD_TUNING.strings.map((_, s) => positionNote({ string: s, fret: 0 }))).toEqual(['E', 'A', 'D', 'G', 'B', 'E']);
  });
  it('computes known positions', () => {
    expect(positionNote({ string: 0, fret: 1 })).toBe('F');
    expect(positionNote({ string: 0, fret: 12 })).toBe('E');
    expect(positionNote({ string: 1, fret: 3 })).toBe('C');
    expect(positionNote({ string: 4, fret: 1 })).toBe('C');
    expect(positionNote({ string: 3, fret: 4 })).toBe('B');
    expect(positionNote({ string: 2, fret: 4 })).toBe('F#');
  });
  it('finds every position of a note', () => {
    const e = positionsOfPc(parseNote('E'), { fretMin: 0, fretMax: 12 });
    for (const p of e) expect(positionNote(p)).toBe('E');
    // 6 strings × 13 frets = 78 cells; each pitch class appears 6 or 7 times
    const total = Array.from({ length: 12 }, (_, pc) => positionsOfPc(pc, { fretMin: 0, fretMax: 12 }).length);
    expect(total.reduce((a, b) => a + b, 0)).toBe(78);
  });
  it('describes shapes', () => {
    expect(describeShape({ string: 1, fret: 5 }, { string: 1, fret: 12 })).toBe('misma cuerda, +7 trastes');
    expect(describeShape({ string: 1, fret: 5 }, { string: 3, fret: 7 })).toBe('2 cuerdas más agudas, +2 trastes');
  });
});
