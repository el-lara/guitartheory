import { describe, expect, it } from 'vitest';
import { conceptWeight, emptySrs, pickConcept, recordResult } from './srs';
import { mulberry32 } from '../util/rng';
import { applyOutcome, emptyProgress, isUnlocked } from '../progression/progress';

describe('srs', () => {
  it('failed concepts come back more often than mastered ones', () => {
    let s = emptySrs();
    for (let i = 0; i < 6; i++) s = recordResult(s, ['note:C'], 'perfect');
    for (let i = 0; i < 3; i++) s = recordResult(s, ['note:F#'], 'fail');
    for (let i = 0; i < 4; i++) s = recordResult(s, ['note:A'], 'perfect'); // advance clock so nothing is "too soon"
    expect(conceptWeight(s, 'note:F#')).toBeGreaterThan(conceptWeight(s, 'note:C') * 3);
    const rng = mulberry32(5);
    const counts: Record<string, number> = { 'note:C': 0, 'note:F#': 0 };
    for (let i = 0; i < 500; i++) counts[pickConcept(s, ['note:C', 'note:F#'], rng)]++;
    expect(counts['note:F#']).toBeGreaterThan(counts['note:C'] * 2);
  });
  it('unseen concepts are introduced; a concept is not repeated immediately', () => {
    let s = emptySrs();
    expect(conceptWeight(s, 'x')).toBeGreaterThan(1);
    s = recordResult(s, ['x'], 'fail');
    expect(conceptWeight(s, 'x')).toBeLessThan(0.5);
  });
  it('tracks streaks and misses', () => {
    let s = recordResult(emptySrs(), ['k'], 'perfect');
    s = recordResult(s, ['k'], 'perfect');
    expect(s.records.k.streak).toBe(2);
    s = recordResult(s, ['k'], 'ok');
    expect(s.records.k.streak).toBe(0);
    expect(s.records.k.misses).toBe(1);
    expect(s.records.k.attempts).toBe(3);
  });
});

describe('progression', () => {
  it('levels up on sustained clean play, down on failure; unlocks by performance', () => {
    let p = emptyProgress();
    expect(isUnlocked(p, 'intervals')).toBe(false);
    for (let i = 0; i < 8; i++) p = applyOutcome(p, 'notes', 'perfect').progress;
    expect(p.notes.level).toBe(2);
    expect(isUnlocked(p, 'intervals')).toBe(true);
    expect(isUnlocked(p, 'chords')).toBe(false);
    for (let i = 0; i < 6; i++) p = applyOutcome(p, 'notes', 'fail').progress;
    expect(p.notes.level).toBe(1);
  });
});
