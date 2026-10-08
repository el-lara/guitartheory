import { describe, expect, it } from 'vitest';
import { ascendingDistance, chordName, chordPcs, intervalName, noteName, parseNote, scalePcs, transpose } from './index';

describe('theory', () => {
  it('parses and names notes', () => {
    expect(parseNote('C')).toBe(0);
    expect(parseNote('F#')).toBe(6);
    expect(parseNote('Bb')).toBe(10);
    expect(parseNote('Db')).toBe(parseNote('C#'));
    expect(noteName(transpose(parseNote('B'), 1))).toBe('C');
    expect(noteName(transpose(parseNote('C'), -1))).toBe('B');
  });
  it('names intervals', () => {
    expect(intervalName(ascendingDistance(parseNote('D'), parseNote('A')))).toBe('quinta justa');
    expect(intervalName(ascendingDistance(parseNote('C'), parseNote('E')))).toBe('tercera mayor');
    expect(intervalName(ascendingDistance(parseNote('B'), parseNote('C')))).toBe('segunda menor');
    expect(intervalName(12)).toBe('octava');
  });
  it('builds triads', () => {
    expect(chordPcs(parseNote('C'), 'maj').map(noteName)).toEqual(['C', 'E', 'G']);
    expect(chordPcs(parseNote('D'), 'maj').map(noteName)).toEqual(['D', 'F#', 'A']);
    expect(chordPcs(parseNote('A'), 'min').map(noteName)).toEqual(['A', 'C', 'E']);
    expect(chordPcs(parseNote('F#'), 'min').map(noteName)).toEqual(['F#', 'A', 'C#']);
    expect(chordName(parseNote('E'), 'min')).toBe('E menor');
  });
  it('builds scales', () => {
    expect(scalePcs(parseNote('G'), 'major').map(noteName)).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#']);
    expect(scalePcs(parseNote('A'), 'naturalMinor').map(noteName)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  });
});
