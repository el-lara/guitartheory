import { libraryPcs, type LibraryQuality } from './chords';
import type { PitchClass } from './notes';
import { scalePcs, type ScaleType } from './scales';

export type Harmonization = 'triads' | 'sevenths';

export interface ScaleChord {
  root: PitchClass;
  quality: LibraryQuality;
  /** Index of the root inside the scale (0 = tonic). */
  degree: number;
}

const TRIADS: LibraryQuality[] = ['maj', 'min', 'dim', 'aug'];
const SUSPENDED: LibraryQuality[] = ['sus2', 'sus4'];
const SEVENTHS: LibraryQuality[] = ['maj7', 'dom7', 'min7', 'm7b5', 'dim7'];

/**
 * Chords that can be built using only notes of the scale, in scale order.
 * For a 7-note scale this is the classic harmonisation (stacked thirds): C major gives
 * C Dm Em F G Am Bdim. Smaller scales (pentatonic, blues) also admit suspended chords.
 */
export function scaleChords(tonic: PitchClass, type: ScaleType, kind: Harmonization): ScaleChord[] {
  const pcs = scalePcs(tonic, type);
  const inScale = new Set(pcs);
  const qualities = kind === 'sevenths' ? SEVENTHS : pcs.length < 7 ? [...TRIADS, ...SUSPENDED] : TRIADS;
  const out: ScaleChord[] = [];
  pcs.forEach((root, degree) => {
    for (const quality of qualities) {
      if (libraryPcs(root, quality).every((pc) => inScale.has(pc))) out.push({ root, quality, degree });
    }
  });
  return out;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const MINOR_LIKE: LibraryQuality[] = ['min', 'dim', 'min7', 'm7b5', 'dim7'];
const NUMERAL_SUFFIX: Partial<Record<LibraryQuality, string>> = { dim: '°', aug: '+', maj7: 'maj7', dom7: '7', min7: '7', m7b5: 'ø', dim7: '°7' };

/** Roman numeral of a chord on degree `degree` of a 7-note scale: I, ii, iii, IV, V, vi, vii°... */
export function romanNumeral(degree: number, quality: LibraryQuality): string {
  const base = ROMAN[degree] ?? '';
  return (MINOR_LIKE.includes(quality) ? base.toLowerCase() : base) + (NUMERAL_SUFFIX[quality] ?? '');
}

