import { describe, expect, it } from 'vitest';
import { positionNote, type Position } from '../fretboard/fretboard';
import { parseNote } from '../theory';
import { evaluateClick, evaluateChoice, initProgress } from './evaluator';
import type { ChordSpec, EvalContext, IntervalSpec, NoteSpec, StepProgress, StepSpec } from './types';

const ctx: EvalContext = { anchors: [] };
const R = { fretMin: 0, fretMax: 12 };
const P = (string: number, fret: number): Position => ({ string, fret });

function play(spec: StepSpec, clicks: Position[]) {
  let prog: StepProgress = initProgress(spec, ctx);
  const results = [];
  for (const c of clicks) {
    const r = evaluateClick(spec, prog, c, ctx);
    prog = r.progress;
    results.push(r);
  }
  return results;
}

describe('note evaluator', () => {
  const spec: NoteSpec = { type: 'note', pc: parseNote('C'), need: 2, region: R };
  it('accepts right notes, rejects wrong ones without giving the answer', () => {
    const [a, b, c] = play(spec, [P(1, 3), P(0, 3), P(4, 1)]);
    expect(a.outcome).toBe('correct');
    expect(b.outcome).toBe('wrong'); // string 6 fret 3 = G
    expect(b.message).toBe('✗ Esa posición es G. Necesitamos C.');
    expect(c.complete).toBe(true);
  });
  it('respects string restriction', () => {
    const s: NoteSpec = { ...spec, need: 1, region: { ...R, strings: [1] } };
    expect(play(s, [P(4, 1)])[0].outcome).toBe('wrong');
    expect(play(s, [P(1, 3)])[0].complete).toBe(true);
  });
});

describe('interval evaluator', () => {
  const spec: IntervalSpec = { type: 'interval', semitones: 7, origin: { kind: 'pick', pc: parseNote('D') }, need: 1, region: R };
  it('accepts any equivalent position for a perfect fifth from D', () => {
    // D on string 4 (fret 0) → A on string 3 fret 2 / string 2 fret 7 / string 1 (A) fret 12 ...
    for (const target of [P(1, 12), P(2, 7), P(3, 2)]) {
      const r = play(spec, [P(2, 0), target]);
      expect(r[1].complete).toBe(true);
    }
    // origin elsewhere: D at string 1 fret 5 → A at string 0? no: A on string 1 fret 12 is too far from region? it's fine;
    const r2 = play(spec, [P(1, 5), P(2, 2 + 5)]); // A (2,7) is a 5th above D (1,5)? D=45+5=50, A=57 → (2,7)=57 ✓
    expect(r2[1].complete).toBe(true);
  });
  it('rejects wrong interval without revealing target and rejects wrong origin', () => {
    const r = play(spec, [P(0, 0), P(2, 0), P(2, 4)]);
    expect(r[0].outcome).toBe('wrong'); // E isn't D
    expect(r[2].outcome).toBe('wrong');
    expect(r[2].message).toBe('✗ Eso es una tercera mayor. Buscamos una quinta justa.');
  });
  it('octave must be exactly 12 semitones above', () => {
    const o: IntervalSpec = { ...spec, semitones: 12, origin: { kind: 'fixed', pos: P(1, 3) } }; // C3
    expect(play(o, [P(1, 12)])[0].outcome).toBe('wrong'); // A string fret12 = A3
    expect(play(o, [P(3, 5)])[0].complete).toBe(true); // G string fret 5 = C4
    expect(play(o, [P(4, 1)])[0].complete).toBe(true); // B string fret 1 = C4 too
    expect(play(o, [P(1, 3)])[0].outcome).toBe('ignored'); // the origin itself
    expect(play(o, [P(5, 8)])[0].outcome).toBe('wrong'); // C5 is two octaves up → too far
  });
});

describe('chord evaluator', () => {
  const D: ChordSpec = { type: 'chord', root: parseNote('D'), quality: 'maj', region: R, locked: [] };
  it('accepts open D major shape (D F# A)', () => {
    const r = play(D, [P(2, 0), P(3, 2), P(4, 3)]); // D, A, D? G string fret2=A, B string fret3=D
    expect(r[1].outcome).toBe('correct');
    expect(r[2].complete).toBe(false);
    const full = play(D, [P(2, 0), P(3, 2), P(5, 2)]); // D A F#
    expect(full[2].complete).toBe(true);
  });
  it('accepts inversions and different positions', () => {
    // F# (string 5 fret 2) as bass, then A, then D
    const r = play(D, [P(0, 2), P(1, 0), P(2, 0)]); // F# A D
    expect(r[2].complete).toBe(true);
    const r2 = play(D, [P(1, 5), P(2, 4), P(3, 2)]); // D F# A
    expect(r2[2].complete).toBe(true);
  });
  it('rejects non chord tones and minor third in major chord', () => {
    const r = play(D, [P(2, 3)]); // F natural
    expect(r[0].outcome).toBe('wrong');
    expect(r[0].message).toBe('✗ Esa posición es F. No pertenece a D mayor.');
  });
  it('rejects shapes no hand can play (info, no penalty)', () => {
    const r = play(D, [P(1, 5), P(4, 10)]);
    expect(r[1].outcome).toBe('info');
  });
  it('minor differs from major', () => {
    const Dm: ChordSpec = { ...D, quality: 'min' };
    expect(positionNote(P(3, 2))).toBe('A');
    const r = play(Dm, [P(2, 0), P(3, 2), P(4, 3)]);
    expect(r[2].outcome).toBe('correct'); // B string fret 3 = D... still chord tone
    expect(play(Dm, [P(5, 2)])[0].outcome).toBe('wrong'); // F# is not in D minor
    expect(play(Dm, [P(5, 1)])[0].outcome).toBe('correct'); // F
  });
  it('choice evaluator', () => {
    const c: StepSpec = { type: 'choice', options: [3, 4, 7], answer: 4, marks: [P(0, 0), P(1, 0)] };
    expect(evaluateChoice(c, initProgress(c, ctx), 1).complete).toBe(true);
    expect(evaluateChoice(c, initProgress(c, ctx), 0).outcome).toBe('wrong');
  });
});
