import { describe, expect, it } from 'vitest';
import { chordSymbol, noteName, parseNote, romanNumeral, scaleChords } from './index';

const symbols = (tonic: string, type: Parameters<typeof scaleChords>[1], kind: Parameters<typeof scaleChords>[2]) =>
  scaleChords(parseNote(tonic), type, kind).map((c) => chordSymbol(c.root, c.quality));

describe('scale harmonisation', () => {
  it('C major triads and sevenths', () => {
    expect(symbols('C', 'major', 'triads')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(symbols('C', 'major', 'sevenths')).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
  });
  it('A natural minor triads (relative of C major)', () => {
    expect(symbols('A', 'naturalMinor', 'triads')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
    expect(symbols('A', 'naturalMinor', 'sevenths')).toEqual(['Am7', 'Bm7♭5', 'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7']);
  });
  it('works in every key: 7 diatonic chords, each only with scale notes', () => {
    for (let t = 0; t < 12; t++) {
      for (const kind of ['triads', 'sevenths'] as const) {
        expect(scaleChords(t, 'major', kind)).toHaveLength(7);
      }
    }
    // G major has F# in its chords
    expect(symbols('G', 'major', 'triads')).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim']);
    expect(noteName(scaleChords(parseNote('G'), 'major', 'triads')[6].root)).toBe('F#');
  });
  it('pentatonic scales only offer chords made of their notes', () => {
    const am = symbols('A', 'pentatonicMinor', 'triads');
    expect(am).toContain('Am');
    expect(am).toContain('C');
    expect(am).not.toContain('Em'); // B is not in A minor pentatonic
    expect(am).not.toContain('G');
  });
  it('roman numerals', () => {
    const romans = scaleChords(parseNote('C'), 'major', 'triads').map((c) => romanNumeral(c.degree, c.quality));
    expect(romans).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    const sev = scaleChords(parseNote('C'), 'major', 'sevenths').map((c) => romanNumeral(c.degree, c.quality));
    expect(sev).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø']);
  });
});
