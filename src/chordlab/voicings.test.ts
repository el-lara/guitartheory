import { describe, expect, it } from 'vitest';
import { LIBRARY_QUALITIES, libraryPcs, parseNote } from '../theory';
import { fretsText, inversionOf, pickVoicing, searchVoicings, stringPc, voicingSymbol } from './voicings';

const texts = (root: string, q: Parameters<typeof searchVoicings>[1], inv: number) =>
  (searchVoicings(parseNote(root), q).find((g) => g.inversion === inv)?.voicings ?? []).map((v) => fretsText(v.frets));

describe('voicing search', () => {
  it('finds the classic open shapes', () => {
    expect(texts('C', 'maj', 0)).toContain('x32010');
    expect(texts('G', 'maj', 0)).toContain('320003');
    expect(texts('A', 'min', 0)).toContain('x02210');
    expect(texts('E', 'min', 0)).toContain('022000');
    expect(texts('D', 'maj', 0)).toContain('xx0232');
    expect(texts('E', 'maj', 0)).toContain('022100');
    expect(texts('F', 'maj', 0)).toContain('133211');
    expect(texts('G', 'dom7', 0)).toContain('320001');
    expect(texts('C', 'maj7', 0)).toContain('x32000');
  });
  it('classifies inversions by the bass note', () => {
    expect(texts('C', 'maj', 1)).toContain('032010'); // C/E
    expect(texts('D', 'maj', 1)).toContain('200232'); // D/F#
    expect(voicingSymbol(parseNote('C'), 'maj', [0, 3, 2, 0, 1, 0])).toBe('C/E');
    expect(voicingSymbol(parseNote('C'), 'maj', [-1, 3, 2, 0, 1, 0])).toBe('C');
  });
  it('every voicing of every chord is valid', () => {
    for (let root = 0; root < 12; root++) {
      for (const q of LIBRARY_QUALITIES) {
        const pcs = libraryPcs(root, q);
        const groups = searchVoicings(root, q);
        expect(groups.length, `${root} ${q}`).toBeGreaterThan(0);
        for (const g of groups) {
          expect(g.voicings.length).toBeLessThanOrEqual(5);
          for (const v of g.voicings) {
            const sounding = v.frets.map((f, s) => ({ f, s })).filter((x) => x.f >= 0);
            expect(sounding.length).toBeGreaterThanOrEqual(4);
            // contiguous strings
            const idx = sounding.map((x) => x.s);
            expect(idx[idx.length - 1] - idx[0] + 1).toBe(idx.length);
            // only chord tones
            for (const x of sounding) expect(pcs).toContain(stringPc(x.s, x.f));
            // hand fits
            const fretted = v.frets.filter((f) => f > 0);
            if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
            expect(v.fingers).toBeLessThanOrEqual(4);
            expect(inversionOf(root, q, v.frets)).toBe(g.inversion);
            expect(Math.max(...v.frets)).toBeLessThanOrEqual(12);
          }
        }
      }
    }
  });
});

describe('voicing ranking', () => {
  it('puts beginner-friendly shapes first', () => {
    const first = (root: string, q: Parameters<typeof searchVoicings>[1]) => fretsText(searchVoicings(parseNote(root), q)[0].voicings[0].frets);
    expect(first('C', 'maj')).toBe('x32010');
    expect(first('A', 'min')).toBe('x02210');
    expect(first('D', 'min')).toBe('xx0231');
    expect(first('G', 'maj')).toBe('320003');
    expect(first('E', 'min')).toBe('022000');
    expect(first('F', 'maj')).toBe('133211');
  });
});

describe('pickVoicing', () => {
  it('uses the easiest shape, or the one nearest a neck position', () => {
    expect(fretsText(pickVoicing(parseNote('C'), 'maj'))).toBe('x32010');
    const near = pickVoicing(parseNote('C'), 'maj', 8);
    expect(Math.min(...near.filter((f) => f > 0))).toBeGreaterThanOrEqual(7);
    expect(inversionOf(parseNote('C'), 'maj', near)).toBe(0);
  });
});
