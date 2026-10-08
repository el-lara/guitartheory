import { describeShape, positionMidi, positionNote, positionPc, type Position } from '../fretboard/fretboard';
import type { StepProgress, StepSpec } from '../engine/types';
import { CHORD_FORMULAS, chordName, chordPcs, intervalName, noteName } from '../theory';

export interface Discovery {
  heading: string;
  lines: string[];
  /** The challenge was failed; the board shows the answer. */
  fail: boolean;
}

export interface StepRecord {
  spec: StepSpec;
  progress: StepProgress;
}

const ORDINAL_INVERSION = ['', ' · 1ª inversión', ' · 2ª inversión'];

function chordBlock(spec: Extract<StepSpec, { type: 'chord' }>, progress: Extract<StepProgress, { type: 'chord' }>) {
  const pcs = chordPcs(spec.root, spec.quality);
  const sel = progress.selected;
  const notes = pcs.map(noteName).join(' ');
  const lowest = [...sel].sort((a, b) => positionMidi(a) - positionMidi(b))[0];
  const inv = lowest ? ORDINAL_INVERSION[pcs.indexOf(positionPc(lowest))] ?? '' : '';
  return { notes, name: chordName(spec.root, spec.quality), inv, spec };
}

function intervalLines(origin: Position, targets: Position[]): { heading: string; lines: string[] } {
  const t0 = targets[0];
  const semis = positionMidi(t0) - positionMidi(origin);
  const from = positionNote(origin);
  const lines = [`${capitalize(intervalName(semis))} · ${semis} ${semis === 1 ? 'semitono' : 'semitonos'}`];
  for (const t of targets) lines.push(`Forma: ${describeShape(origin, t)}`);
  return { heading: `${from} → ${positionNote(t0)}`, lines };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Short "what you just did" explanation. Returns null when the challenge teaches nothing new (plain note hunting). */
export function buildDiscovery(records: StepRecord[], fail: boolean): Discovery | null {
  const chords = records.filter((r): r is { spec: Extract<StepSpec, { type: 'chord' }>; progress: Extract<StepProgress, { type: 'chord' }> } => r.spec.type === 'chord' && r.progress.type === 'chord');
  if (chords.length) {
    const blocks = chords.map((c) => chordBlock(c.spec, c.progress));
    const last = blocks[blocks.length - 1];
    const f = CHORD_FORMULAS[last.spec.quality];
    const pcs = chordPcs(last.spec.root, last.spec.quality);
    const root = noteName(pcs[0]);
    const lines: string[] = [];
    if (blocks.length > 1) {
      for (const b of blocks) lines.push(`${b.name}: ${b.notes}`);
    } else {
      lines.push(`${last.name}${last.inv}`);
    }
    f.intervals.slice(1).forEach((semi, i) => {
      lines.push(`${root} → ${noteName(pcs[i + 1])} = ${intervalName(semi)}`);
    });
    lines.push(`Una ${f.family} es ${f.degrees.join(' · ')}`);
    return { heading: `${fail ? '' : '✓ '}${blocks.map((b) => b.notes).join('  →  ')}`, lines, fail };
  }
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i];
    if (r.spec.type === 'interval' && r.progress.type === 'interval' && r.progress.origin && r.progress.targets.length) {
      const d = intervalLines(r.progress.origin, r.progress.targets);
      return { heading: `${fail ? '' : '✓ '}${d.heading}`, lines: d.lines, fail };
    }
    if (r.spec.type === 'choice') {
      const [a, b] = r.spec.marks;
      const d = intervalLines(a, [b]);
      return { heading: `${fail ? '' : '✓ '}${d.heading}`, lines: d.lines.slice(0, 1), fail };
    }
  }
  return fail ? { heading: 'Así era', lines: [], fail } : null;
}
