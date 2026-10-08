import { positionPc, stringOrdinal, type Position } from '../fretboard/fretboard';
import { chordPcs, intervalName, noteName } from '../theory';
import { acceptedClicks } from './evaluator';
import type { EvalContext, StepProgress, StepSpec } from './types';

export interface Hint {
  text: string;
  /** Exact position to highlight (last, most revealing hint). */
  pos?: Position;
}

/** How many progressive hints a step offers at most. */
export const MAX_HINT_LEVELS = 3;

const nearestFirst = (a: Position, b: Position) => a.fret - b.fret || a.string - b.string;

function stringsText(cands: Position[]): string {
  const strings = [...new Set(cands.map((p) => p.string))].sort((a, b) => b - a);
  return strings.map((s) => stringOrdinal(s)).join(', ');
}

/** Hints for finding a note among `cands`: strings → zone → exact spot. */
function findingHint(label: string, cands: Position[], level: number): Hint | null {
  if (!cands.length) return null;
  const sorted = [...cands].sort(nearestFirst);
  const p = sorted[0];
  if (level === 0) return { text: `${label}: mira en ${cands.length === 1 ? 'la cuerda' : 'las cuerdas'} ${stringsText(cands)}.` };
  if (level === 1) {
    const a = Math.max(0, p.fret - 1);
    return { text: `Prueba en la cuerda ${stringOrdinal(p.string)}, entre los trastes ${a} y ${p.fret + 1}.` };
  }
  if (level === 2) return { text: 'Mira la posición marcada.', pos: p };
  return null;
}

/**
 * Progressive hint for the current step. Hints never click for the user; the last level
 * only highlights one valid spot. Returns null when there are no more levels.
 */
export function hintFor(spec: StepSpec, progress: StepProgress, ctx: EvalContext, level: number): Hint | null {
  if (level >= MAX_HINT_LEVELS) return null;
  if (spec.type === 'choice') {
    if (level === 0) return { text: 'Cuenta los semitonos entre el punto 1 y el 2.' };
    if (level === 1) return { text: `Hay ${spec.answer} semitonos de distancia.` };
    return null;
  }
  const cands = acceptedClicks(spec, progress, ctx);
  if (spec.type === 'note') return findingHint(noteName(spec.pc), cands, level);
  if (spec.type === 'interval' && progress.type === 'interval') {
    if (!progress.origin && spec.origin.kind === 'pick') return findingHint(`Primero ${noteName(spec.origin.pc)}`, cands, level);
    const target = cands[0];
    if (!target) return null;
    if (level === 0) return { text: `${intervalName(spec.semitones)}: ${spec.semitones} semitonos por encima del origen.` };
    if (level === 1) return findingHint(`Buscas ${noteName(positionPc(target))}`, cands, 0);
    return findingHint('', cands, 2);
  }
  if (spec.type === 'chord' && progress.type === 'chord') {
    const have = new Set(progress.selected.map((p) => positionPc(p)));
    const missing = chordPcs(spec.root, spec.quality).filter((pc) => !have.has(pc));
    if (level === 0) return { text: `Las notas del acorde son ${chordPcs(spec.root, spec.quality).map(noteName).join(' · ')}.` };
    if (!missing.length) return null;
    const missingCands = cands.filter((p) => positionPc(p) === missing[0]);
    if (level === 1) return findingHint(`Te falta ${noteName(missing[0])}`, missingCands, 0);
    return findingHint('', missingCands, 2);
  }
  return null;
}
