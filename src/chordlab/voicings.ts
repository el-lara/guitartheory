import { STANDARD_TUNING } from '../fretboard/fretboard';
import { CHORD_LIBRARY, libraryPcs, mod12, noteName, type LibraryChord, type LibraryQuality, type PitchClass } from '../theory';

/** One fret per string, index 0 = 6ª (lowest). -1 = muted, 0 = open. */
export type Frets = number[];

export interface Barre {
  fret: number;
  /** String indexes (inclusive) covered by the index finger. */
  from: number;
  to: number;
}

export interface Voicing {
  frets: Frets;
  /** Chord-tone index of the lowest sounding note: 0 = root position, 1 = first inversion... */
  inversion: number;
  fingers: number;
  barre: Barre | null;
  /** First fret shown in a chord diagram. */
  base: number;
  score: number;
}

export interface InversionGroup {
  inversion: number;
  label: string;
  voicings: Voicing[];
}

const MAX_FRET = 12;
const MAX_SPAN = 3; // fretted notes within 4 consecutive frets
const MAX_PER_INVERSION = 5;
const OPEN_POSITION_MAX = 5;

export const INVERSION_LABELS = ['Posición fundamental', '1ª inversión', '2ª inversión', '3ª inversión'];

const stringPc = (s: number, fret: number): PitchClass => mod12(STANDARD_TUNING.strings[s].midi + fret);

/** MIDI note of each sounding string. */
export const fretsMidi = (frets: Frets): number[] =>
  frets.flatMap((f, s) => (f < 0 ? [] : [STANDARD_TUNING.strings[s].midi + f]));

/** Which chord tone is in the bass (index into the chord formula), or -1. */
export function inversionOf(root: PitchClass, quality: LibraryQuality, frets: Frets): number {
  const s = frets.findIndex((f) => f >= 0);
  if (s < 0) return -1;
  return libraryPcs(root, quality).indexOf(stringPc(s, frets[s]));
}

/** Finger count and barre detection. */
export function fingeringOf(frets: Frets) {
  return fingering(frets);
}

function fingering(frets: Frets): { fingers: number; barre: Barre | null } {
  const fretted = frets.map((f, s) => ({ f, s })).filter((x) => x.f > 0);
  if (!fretted.length) return { fingers: 0, barre: null };
  const min = Math.min(...fretted.map((x) => x.f));
  const atMin = fretted.filter((x) => x.f === min);
  if (atMin.length >= 2) {
    const from = atMin[0].s;
    const to = atMin[atMin.length - 1].s;
    // a barre needs every string it crosses to be fretted at or above that fret
    const ok = frets.slice(from, to + 1).every((f) => f >= min);
    if (ok) return { fingers: 1 + (fretted.length - atMin.length), barre: { fret: min, from, to } };
  }
  return { fingers: fretted.length, barre: null };
}

function scoreOf(frets: Frets, fingers: number, barre: Barre | null): number {
  const fretted = frets.filter((f) => f > 0);
  const muted = frets.filter((f) => f < 0).length;
  const open = frets.filter((f) => f === 0).length;
  const min = fretted.length ? Math.min(...fretted) : 0;
  const span = fretted.length ? Math.max(...fretted) - min : 0;
  return fingers * 1.5 + muted * 2 + span * 0.5 + min * 0.6 + (barre ? 1.5 : 0) - open * 0.3;
}

/**
 * Finds playable shapes of a chord: every voicing uses chord tones only, keeps the sounding
 * strings contiguous, fits one hand (4 frets, max 4 fingers) and is grouped by its bass note
 * (= inversion). Deterministic: derived from the tuning and the chord formula, no shape tables.
 */
export function searchVoicings(root: PitchClass, quality: LibraryQuality): InversionGroup[] {
  const def: LibraryChord = CHORD_LIBRARY[quality];
  const pcs = libraryPcs(root, quality);
  const strings = STANDARD_TUNING.strings.length;
  // tones that must be present (the fifth may be dropped in 7th chords)
  const required = pcs.filter((_, i) => !(def.optionalFifth && def.intervals[i] === 7));

  const options: number[][] = [];
  for (let s = 0; s < strings; s++) {
    const o = [-1];
    for (let f = 0; f <= MAX_FRET; f++) if (pcs.includes(stringPc(s, f))) o.push(f);
    options.push(o);
  }

  const found: Voicing[] = [];
  const cur: number[] = [];
  const rec = (s: number, phase: 0 | 1 | 2, lo: number, hi: number) => {
    if (s === strings) {
      const sounding = cur.filter((f) => f >= 0).length;
      if (sounding < 4) return;
      const have = new Set(cur.flatMap((f, i) => (f >= 0 ? [stringPc(i, f)] : [])));
      if (!required.every((pc) => have.has(pc))) return;
      const frets = [...cur];
      // open strings only make sense with the hand in open position
      if (frets.includes(0) && Math.max(...frets) > OPEN_POSITION_MAX) return;
      const { fingers, barre } = fingering(frets);
      if (fingers > 4) return;
      const inversion = inversionOf(root, quality, frets);
      const fretted = frets.filter((f) => f > 0);
      const min = fretted.length ? Math.min(...fretted) : 0;
      found.push({ frets, inversion, fingers, barre, base: min >= 2 ? min : 1, score: scoreOf(frets, fingers, barre) });
      return;
    }
    for (const f of options[s]) {
      let nPhase = phase;
      let nLo = lo;
      let nHi = hi;
      if (f < 0) {
        if (phase === 1) nPhase = 2;
      } else {
        if (phase === 2) continue; // a muted string in the middle
        nPhase = 1;
        if (f > 0) {
          nLo = Math.min(lo, f);
          nHi = Math.max(hi, f);
          if (nHi - nLo > MAX_SPAN) continue;
        }
      }
      cur[s] = f;
      rec(s + 1, nPhase, nLo, nHi);
    }
  };
  rec(0, 0, 99, 0);

  const groups: InversionGroup[] = [];
  for (let inv = 0; inv < pcs.length; inv++) {
    const all = found.filter((v) => v.inversion === inv).sort((a, b) => a.score - b.score || a.frets.join().localeCompare(b.frets.join()));
    const picked: Voicing[] = [];
    for (const v of all) {
      // keep the list varied: skip shapes in (almost) the same neck position as one already chosen
      if (picked.some((p) => Math.abs(p.base - v.base) < 2)) continue;
      picked.push(v);
      if (picked.length === MAX_PER_INVERSION) break;
    }
    if (picked.length) groups.push({ inversion: inv, label: INVERSION_LABELS[inv], voicings: picked });
  }
  return groups;
}

/** Slash-style label: "C", "C/E". */
export function voicingSymbol(root: PitchClass, quality: LibraryQuality, frets: Frets): string {
  const inv = inversionOf(root, quality, frets);
  const base = `${noteName(root)}${CHORD_LIBRARY[quality].suffix}`;
  if (inv <= 0) return base;
  const s = frets.findIndex((f) => f >= 0);
  return `${base}/${noteName(stringPc(s, frets[s]))}`;
}

/** "x32010" style text. */
export const fretsText = (frets: Frets): string => frets.map((f) => (f < 0 ? 'x' : f > 9 ? `(${f})` : String(f))).join('');

export { stringPc };
