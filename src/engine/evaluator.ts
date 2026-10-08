import {
  inRegion,
  posKey,
  positionMidi,
  positionNote,
  positionPc,
  regionPositions,
  samePos,
  stringOrdinal,
  type Position,
} from '../fretboard/fretboard';
import { CHORD_FORMULAS, chordName, chordPcs, intervalName, intervalWithArticle, noteName } from '../theory';
import type {
  ChordSpec,
  ClickResult,
  EvalContext,
  IntervalSpec,
  NoteSpec,
  StepProgress,
  StepSpec,
} from './types';

/** Max distance (in frets) a hand can reasonably cover for a chord shape. */
export const MAX_HAND_SPAN = 4;

export function initProgress(spec: StepSpec, ctx: EvalContext): StepProgress {
  switch (spec.type) {
    case 'note':
      return { type: 'note', found: [] };
    case 'interval': {
      if (spec.origin.kind === 'fixed') return { type: 'interval', origin: spec.origin.pos, targets: [] };
      if (spec.origin.kind === 'ref') return { type: 'interval', origin: ctx.anchors[spec.origin.step], targets: [] };
      return { type: 'interval', targets: [] };
    }
    case 'chord':
      return { type: 'chord', selected: [...spec.locked] };
    case 'choice':
      return { type: 'choice' };
  }
}

/** First position that "anchors" the step, used by later `ref` steps. */
export function stepAnchor(progress: StepProgress): Position | undefined {
  switch (progress.type) {
    case 'note':
      return progress.found[0];
    case 'interval':
      return progress.targets[0];
    default:
      return undefined;
  }
}

const res = (
  outcome: ClickResult['outcome'],
  progress: StepProgress,
  message: string,
  complete = false,
): ClickResult => ({ outcome, complete, progress, message });

export function evaluateClick(
  spec: StepSpec,
  progress: StepProgress,
  pos: Position,
  _ctx: EvalContext,
): ClickResult {
  if (spec.type === 'note' && progress.type === 'note') return evalNote(spec, progress, pos);
  if (spec.type === 'interval' && progress.type === 'interval') return evalInterval(spec, progress, pos);
  if (spec.type === 'chord' && progress.type === 'chord') return evalChord(spec, progress, pos);
  return res('ignored', progress, '');
}

export function evaluateChoice(spec: StepSpec, progress: StepProgress, index: number): ClickResult {
  if (spec.type !== 'choice') return res('ignored', progress, '');
  const next: StepProgress = { type: 'choice', picked: index };
  if (spec.options[index] === spec.answer) return res('correct', next, '✓ Correcto', true);
  return res('wrong', progress, '✗ No es esa distancia. Cuenta los semitonos.');
}

function evalNote(spec: NoteSpec, progress: Extract<StepProgress, { type: 'note' }>, pos: Position): ClickResult {
  if (progress.found.some((p) => samePos(p, pos))) return res('ignored', progress, 'Esa ya la tienes.');
  const target = noteName(spec.pc);
  const got = positionNote(pos);
  if (positionPc(pos) !== spec.pc) return res('wrong', progress, `✗ Esa posición es ${got}. Necesitamos ${target}.`);
  if (spec.exclude?.some((p) => samePos(p, pos))) return res('wrong', progress, '✗ Esa es la que te mostré. Busca otra.');
  if (!inRegion(pos, spec.region)) {
    const r = spec.region;
    const where = r.strings && r.strings.length === 1
      ? `en la cuerda ${stringOrdinal(r.strings[0])}`
      : `entre los trastes ${r.fretMin} y ${r.fretMax}`;
    return res('wrong', progress, `✗ Es ${target}, pero buscamos ${where}.`);
  }
  if (spec.allowed && !spec.allowed.some((p) => samePos(p, pos))) {
    return res('info', progress, 'Ese no deja espacio para lo siguiente. Prueba con otra posición.');
  }
  const found = [...progress.found, pos];
  const next: StepProgress = { type: 'note', found };
  const complete = found.length >= spec.need;
  return res('correct', next, spec.need > 1 && !complete ? `✓ ${found.length} de ${spec.need}` : '✓ Correcto', complete);
}

function evalInterval(
  spec: IntervalSpec,
  progress: Extract<StepProgress, { type: 'interval' }>,
  pos: Position,
): ClickResult {
  const origin = progress.origin;
  const wanted = intervalName(spec.semitones);

  if (!origin) {
    // 'pick' origin: first click must be the origin pitch class
    if (spec.origin.kind !== 'pick') return res('ignored', progress, '');
    if (positionPc(pos) !== spec.origin.pc) {
      return res('wrong', progress, `✗ Esa es ${positionNote(pos)}. Primero busca ${noteName(spec.origin.pc)}.`);
    }
    if (!regionPositions(spec.region).some((t) => positionMidi(t) - positionMidi(pos) === spec.semitones)) {
      return res('info', progress, 'Desde ahí no hay espacio para esa distancia. Prueba otra posición.');
    }
    return res('correct', { ...progress, origin: pos }, `✓ Origen: ${noteName(spec.origin.pc)}. Ahora busca ${intervalWithArticle(spec.semitones)}.`);
  }

  // Clicking the origin of a 'pick' step un-picks it so the user can choose another one.
  if (samePos(origin, pos)) {
    if (spec.origin.kind === 'pick' && progress.targets.length === 0) {
      return res('info', { ...progress, origin: undefined }, 'Origen quitado. Elige otro.');
    }
    return res('ignored', progress, '');
  }
  if (progress.targets.some((p) => samePos(p, pos))) return res('ignored', progress, 'Esa ya la tienes.');

  const diff = positionMidi(pos) - positionMidi(origin);
  if (diff !== spec.semitones) {
    if (diff <= 0) return res('wrong', progress, '✗ Esa suena igual o más grave que el origen.');
    if (diff > 12) return res('wrong', progress, '✗ Esa queda a más de una octava.');
    return res('wrong', progress, `✗ Eso es ${intervalWithArticle(diff)}. Buscamos ${intervalWithArticle(spec.semitones)}.`);
  }
  if (!inRegion(pos, spec.region)) {
    return res('wrong', progress, `✗ Es ${wanted}, pero fuera de la zona de juego.`);
  }
  const targets = [...progress.targets, pos];
  const complete = targets.length >= spec.need;
  return res('correct', { ...progress, targets }, spec.need > 1 && !complete ? `✓ ${targets.length} de ${spec.need}` : '✓ Correcto', complete);
}

/** Largest fret distance between fretted (non-open) notes. */
export function handSpan(positions: Position[]): number {
  const frets = positions.filter((p) => p.fret > 0).map((p) => p.fret);
  return frets.length === 0 ? 0 : Math.max(...frets) - Math.min(...frets);
}

function chordCovered(spec: ChordSpec, selected: Position[]): boolean {
  const have = new Set(selected.map((p) => positionPc(p)));
  return chordPcs(spec.root, spec.quality).every((pc) => have.has(pc));
}

function evalChord(spec: ChordSpec, progress: Extract<StepProgress, { type: 'chord' }>, pos: Position): ClickResult {
  if (spec.locked.some((p) => samePos(p, pos))) return res('ignored', progress, 'Esa nota ya está puesta.');
  const selected = progress.selected;
  // toggle off
  if (selected.some((p) => samePos(p, pos))) {
    return res('info', { type: 'chord', selected: selected.filter((p) => !samePos(p, pos)) }, '');
  }
  const pcs = chordPcs(spec.root, spec.quality);
  const pc = positionPc(pos);
  const name = chordName(spec.root, spec.quality);
  if (!pcs.includes(pc)) return res('wrong', progress, `✗ Esa posición es ${positionNote(pos)}. No pertenece a ${name}.`);
  if (!inRegion(pos, spec.region)) {
    return res('wrong', progress, `✗ Es ${noteName(pc)}, pero fuera de la zona (trastes ${spec.region.fretMin}–${spec.region.fretMax}).`);
  }
  if (spec.rootString !== undefined && pc === spec.root && pos.string !== spec.rootString) {
    return res('wrong', progress, `✗ La raíz ${noteName(spec.root)} va en la cuerda ${stringOrdinal(spec.rootString)}.`);
  }
  if (spec.locked.some((l) => l.string === pos.string)) {
    return res('info', progress, 'Esa cuerda ya tiene una nota fija.');
  }
  const next = [...selected.filter((p) => p.string !== pos.string), pos];
  if (handSpan(next) > MAX_HAND_SPAN) return res('info', progress, 'Demasiado lejos para una sola mano.');
  const complete = chordCovered(spec, next);
  return res('correct', { type: 'chord', selected: next }, complete ? '✓' : `✓ ${noteName(pc)}`, complete);
}

/** All positions that would be accepted as the next correct click. */
export function acceptedClicks(spec: StepSpec, progress: StepProgress, ctx: EvalContext): Position[] {
  if (spec.type === 'choice') return [];
  // Interval origins may sit outside the target region, so scan the whole neck for them.
  const needsOrigin = spec.type === 'interval' && progress.type === 'interval' && !progress.origin;
  const pool = regionPositions(needsOrigin ? { fretMin: 0, fretMax: 12 } : spec.region);
  return pool.filter((p) => evaluateClick(spec, progress, p, ctx).outcome === 'correct');
}

function solveFrom(spec: StepSpec, progress: StepProgress, ctx: EvalContext, preferFret: number): { placed: Position[]; done: boolean } {
  const placed: Position[] = [];
  let cur = progress;
  for (let i = 0; i < 16; i++) {
    let options = acceptedClicks(spec, cur, ctx);
    if (spec.type === 'chord' && cur.type === 'chord') {
      const have = new Set(cur.selected.map((p) => positionPc(p)));
      options = options.filter((p) => !have.has(positionPc(p)));
    }
    options.sort((a, b) => Math.abs(a.fret - preferFret) - Math.abs(b.fret - preferFret) || a.string - b.string);
    const opt = options.find((p) => !placed.some((q) => posKey(q) === posKey(p)));
    if (!opt) return { placed, done: false };
    const r = evaluateClick(spec, cur, opt, ctx);
    cur = r.progress;
    placed.push(opt);
    if (r.complete) return { placed, done: true };
  }
  return { placed, done: false };
}

/**
 * Greedy solver: repeatedly applies an accepted click (closest to `preferFret`) until the
 * step completes. Used to reveal answers after a failure, and by tests as a "perfect bot".
 */
export function autoSolve(spec: StepSpec, progress: StepProgress, ctx: EvalContext, preferFret = 3): Position[] {
  let best: Position[] = [];
  for (const f of [preferFret, ...Array.from({ length: 13 }, (_, i) => i)]) {
    const r = solveFrom(spec, progress, ctx, f);
    if (r.done) return r.placed;
    if (r.placed.length > best.length) best = r.placed;
  }
  return best;
}

export const chordDegreesLabel = (spec: ChordSpec): string => CHORD_FORMULAS[spec.quality].degrees.join(' · ');
