import { describe, expect, it } from 'vitest';
import { ascendingDistance, chordName, chordPcs, fifthsPc, intervalName, keySignature, noteName, parseNote, scalePcs, scaleSteps, transpose } from './index';

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
  it('builds pentatonic and blues scales and step patterns', () => {
    expect(scalePcs(parseNote('A'), 'pentatonicMinor').map(noteName)).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(scalePcs(parseNote('C'), 'pentatonicMajor').map(noteName)).toEqual(['C', 'D', 'E', 'G', 'A']);
    expect(scalePcs(parseNote('A'), 'blues').map(noteName)).toEqual(['A', 'C', 'D', 'D#', 'E', 'G']);
    expect(scaleSteps('major')).toEqual([2, 2, 1, 2, 2, 2, 1]);
    expect(scaleSteps('naturalMinor')).toEqual([2, 1, 2, 2, 1, 2, 2]);
    expect(scaleSteps('pentatonicMinor')).toEqual([3, 2, 2, 3, 2]);
  });
  it('relative minor shares notes with its major (same set, other tonic)', () => {
    const cMajor = [...scalePcs(parseNote('C'), 'major')].sort((a, b) => a - b);
    const aMinor = [...scalePcs(parseNote('A'), 'naturalMinor')].sort((a, b) => a - b);
    expect(aMinor).toEqual(cMajor);
  });
  it('circle of fifths: order and key signatures', () => {
    expect(Array.from({ length: 12 }, (_, k) => noteName(fifthsPc(k)))).toEqual(['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F']);
    expect(keySignature(1)).toEqual({ kind: 'sharps', count: 1, notes: ['F#'] });
    expect(keySignature(11)).toEqual({ kind: 'flats', count: 1, notes: ['Bb'] });
    expect(keySignature(0).count).toBe(0);
    // a major scale occupies 7 consecutive places on the circle of fifths (IV I V II VI III VII)
    const k = 3; // A
    const around = Array.from({ length: 7 }, (_, i) => fifthsPc(k - 1 + i)).sort((a, b) => a - b);
    expect(around).toEqual([...scalePcs(fifthsPc(k), 'major')].sort((a, b) => a - b));
  });
});
