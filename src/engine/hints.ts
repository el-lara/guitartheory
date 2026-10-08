import { describeShape, positionPc, STANDARD_TUNING, stringOrdinal, type Position } from '../fretboard/fretboard';
import {
  ascendingDistance,
  CHORD_FORMULAS,
  chordName,
  chordPcs,
  intervalName,
  noteName,
  transpose,
} from '../theory';
import { acceptedClicks } from './evaluator';
import type { EvalContext, StepProgress, StepSpec } from './types';

export interface Hint {
  /** Short theory lesson tied to the current step. */
  text: string;
  /** Last level may highlight one valid spot. */
  pos?: Position;
}

/** Progressive levels per step: general rule → method for this exact case → pattern + highlighted spot. */
export const MAX_HINT_LEVELS = 3;

const nearestFirst = (a: Position, b: Position) => a.fret - b.fret || a.string - b.string;
const openNote = (s: number) => noteName(STANDARD_TUNING.strings[s].midi);

const SEMITONE_RULE =
  'Cada traste sube 1 semitono. Las 12 notas son C C# D D# E F F# G G# A A# B (y vuelve a empezar). Entre E–F y B–C no hay nota intermedia.';

const STRING_RULE =
  'Las cuerdas vecinas están a 5 semitonos (una cuarta justa), salvo de la 3ª (G) a la 2ª (B), que está a 4. Por eso la misma nota queda 5 trastes más atrás en la cuerda siguiente más aguda (4 si cruzas G→B).';

/** Number of the interval counting from the origin (a 5th = 5th note counting the origin as 1). */
const DEGREE = [1, 2, 2, 3, 3, 4, 0, 5, 6, 6, 7, 7, 8];

function intervalLesson(semitones: number): string {
  const name = intervalName(semitones);
  if (semitones === 6) return 'Tritono: 6 semitonos, justo la mitad de una octava.';
  const deg = DEGREE[semitones];
  const quality = name.includes('justa') || semitones === 12
    ? 'Las justas (4ª, 5ª y 8ª) son los intervalos más estables.'
    : name.includes('mayor')
      ? `Su versión menor mide 1 semitono menos (${semitones - 1}).`
      : `Su versión mayor mide 1 semitono más (${semitones + 1}).`;
  return `${cap(name)} = ${semitones} semitonos: es la nota nº ${deg} contando desde el origen. ${quality}`;
}

const semis = (n: number) => `${n} ${n === 1 ? 'semitono' : 'semitonos'}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Method to find `pc` using the open string of the nearest candidate. */
function methodFor(pc: number, cands: Position[]): string {
  const p = [...cands].sort(nearestFirst)[0];
  const open = openNote(p.string);
  const note = noteName(pc);
  if (p.fret === 0) return `Parte de la cuerda al aire: la ${stringOrdinal(p.string)} suena ${open}, así que ${note} es la cuerda suelta.`;
  return `Parte de una cuerda al aire: la ${stringOrdinal(p.string)} suena ${open}. De ${open} a ${note} hay ${semis(p.fret)}, y cada traste es 1 semitono → traste ${p.fret}.`;
}

function noteHints(pc: number, cands: Position[], level: number): Hint | null {
  if (!cands.length) return null;
  if (level === 0) return { text: SEMITONE_RULE };
  if (level === 1) return { text: methodFor(pc, cands) };
  return { text: STRING_RULE, pos: [...cands].sort(nearestFirst)[0] };
}

function chordHints(spec: Extract<StepSpec, { type: 'chord' }>, progress: Extract<StepProgress, { type: 'chord' }>, cands: Position[], level: number): Hint | null {
  const f = CHORD_FORMULAS[spec.quality];
  const pcs = chordPcs(spec.root, spec.quality);
  const have = new Set(progress.selected.map((p) => positionPc(p)));
  const missing = pcs.filter((pc) => !have.has(pc));
  const third = intervalName(f.intervals[1]);
  if (level === 0) {
    return {
      text: `${chordName(spec.root, spec.quality)} = raíz ${noteName(pcs[0])} (1) + ${third} (${f.intervals[1]} semitonos) → ${noteName(pcs[1])} (${f.degrees[1]}) + quinta justa (7) → ${noteName(pcs[2])} (5).`,
    };
  }
  if (level === 1) {
    const diff = spec.quality === 'maj' ? 'La tercera mayor mide 4 semitonos; en un acorde menor mide 3.' : 'La tercera menor mide 3 semitonos; en un acorde mayor mide 4.';
    return { text: `Mayor y menor solo cambian la tercera. ${diff}${missing.length && missing.length < pcs.length ? ` Te falta: ${missing.map(noteName).join(', ')}.` : ''}` };
  }
  const target = cands.filter((p) => missing.length && positionPc(p) === missing[0]).sort(nearestFirst)[0];
  if (!target) return null;
  return {
    text: `Cada cuerda suena una sola nota. Puedes usar cualquier orden o repetir notas (inversiones). Busca ${noteName(missing[0])} cerca de lo que ya tienes.`,
    pos: target,
  };
}

function intervalHints(spec: Extract<StepSpec, { type: 'interval' }>, progress: Extract<StepProgress, { type: 'interval' }>, cands: Position[], level: number): Hint | null {
  if (!progress.origin && spec.origin.kind === 'pick') {
    // first the origin note: same note-finding lessons
    const origin = noteName(spec.origin.pc);
    if (level === 0) return { text: `Un intervalo es la distancia en semitonos entre dos notas. ${intervalLesson(spec.semitones)}` };
    if (level === 1) return cands.length ? { text: `Primero el origen, ${origin}. ${methodFor(spec.origin.pc, cands)}` } : null;
    return cands.length ? { text: `Cuando tengas ${origin}, cuenta ${spec.semitones} semitonos hacia arriba.`, pos: [...cands].sort(nearestFirst)[0] } : null;
  }
  const origin = progress.origin;
  const target = [...cands].sort(nearestFirst)[0];
  if (!origin || !target) return null;
  if (level === 0) return { text: `Un intervalo es la distancia en semitonos entre dos notas. ${intervalLesson(spec.semitones)}` };
  const targetNote = noteName(transpose(positionPc(origin), spec.semitones));
  if (level === 1) {
    return { text: `${noteName(positionPc(origin))} + ${spec.semitones} semitonos = ${targetNote}. En el mástil: subir una cuerda suma 5 semitonos (4 entre G y B) y cada traste suma 1. Forma posible: ${describeShape(origin, target)}.` };
  }
  return { text: `Busca ${targetNote}: de ${noteName(positionPc(origin))} a ${targetNote} hay ${semis(ascendingDistance(positionPc(origin), positionPc(target)))} (dentro de una octava).`, pos: target };
}

/**
 * Progressive theory hint for the current step. Hints never click for the user; the last
 * level may highlight one valid spot. Returns null when there are no more levels.
 */
export function hintFor(spec: StepSpec, progress: StepProgress, ctx: EvalContext, level: number): Hint | null {
  if (level >= MAX_HINT_LEVELS) return null;
  if (spec.type === 'choice') {
    if (level === 0) return { text: 'Un intervalo es la distancia en semitonos. Cuenta de 1 a 2: cada traste suma 1, subir de cuerda suma 5 (4 entre G y B).' };
    if (level === 1) return { text: `Son ${spec.answer} semitonos. Referencia: 1 = 2ª menor · 2 = 2ª mayor · 3 = 3ª menor · 4 = 3ª mayor · 5 = 4ª · 6 = tritono · 7 = 5ª · 8 = 6ª menor · 9 = 6ª mayor · 10 = 7ª menor · 11 = 7ª mayor · 12 = octava.` };
    return null;
  }
  const cands = acceptedClicks(spec, progress, ctx);
  if (spec.type === 'note') return noteHints(spec.pc, cands, level);
  if (spec.type === 'interval' && progress.type === 'interval') return intervalHints(spec, progress, cands, level);
  if (spec.type === 'chord' && progress.type === 'chord') return chordHints(spec, progress, cands, level);
  return null;
}
