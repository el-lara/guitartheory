import { generateChallenge } from '../challenges/generate';
import type { Challenge } from '../challenges/types';
import { hintFor } from '../engine/hints';
import { autoSolve, evaluateChoice, evaluateClick, initProgress, stepAnchor } from '../engine/evaluator';
import type { EvalContext, StepProgress } from '../engine/types';
import type { Position } from '../fretboard/fretboard';
import { applyOutcome, isUnlocked, type Progress } from '../progression/progress';
import { levelDef, STAGES, type StageId } from '../progression/stages';
import { averageWeakness, recordResult, type Outcome, type SrsState } from '../srs/srs';
import { intervalName, noteName, parseNote, CHORD_FORMULAS, type ChordQuality } from '../theory';
import { weightedPick, type Rng } from '../util/rng';
import { buildDiscovery, type Discovery, type StepRecord } from './discovery';

export type Phase = 'idle' | 'playing' | 'discovery' | 'summary';
export type Mode = 'mix' | StageId;
export interface SessionConfig {
  mode: Mode;
  minutes: number;
}

export const MAX_LIVES = 5;
export const MAX_MISTAKES_PER_CHALLENGE = 3;
/** Correct actions in a row needed to regain a life. */
export const STREAK_PER_LIFE = 6;

export interface Feedback {
  id: number;
  kind: 'ok' | 'bad' | 'info';
  text: string;
}

export interface Summary {
  total: number;
  perfect: number;
  bestStreak: number;
  score: number;
  tip: string;
  reason: 'time' | 'lives' | 'quit';
  newBest: boolean;
}

export interface Snapshot {
  phase: Phase;
  config: SessionConfig;
  sessionMsLeft: number;
  score: number;
  streak: number;
  bestStreak: number;
  lives: number;
  total: number;
  perfect: number;
  challenge: Challenge | null;
  stepIndex: number;
  progress: StepProgress | null;
  challengeMsLeft: number | null;
  revealMsLeft: number;
  feedback: Feedback | null;
  /** Position of the last wrong click, flashes red. */
  flash: { id: number; pos: Position } | null;
  discovery: Discovery | null;
  /** Answer shown on the board after a failed challenge. */
  solution: Position[];
  levelToast: { id: number; text: string } | null;
  /** Show every note name on the neck (study aid; makes the challenge "assisted"). */
  reveal: boolean;
  hints: string[];
  hintPos: Position | null;
  hintsDone: boolean;
  summary: Summary | null;
  levels: Record<StageId, number>;
  bestScore: number;
}

export interface Persisted {
  srs: SrsState;
  progress: Progress;
  bestScore: number;
}

export interface GameOptions {
  initial: Persisted;
  rng: Rng;
  save?: (p: Persisted) => void;
  unlockAll?: boolean;
}

const ADVANCE_MS = 550;
const FLASH_MS = 450;

export class Game {
  private srs: SrsState;
  private progress: Progress;
  private bestScore: number;
  private rng: Rng;
  private save?: (p: Persisted) => void;
  private unlockAll: boolean;

  private s: Snapshot;
  private snap: Snapshot;
  private listeners = new Set<() => void>();
  private uid = 1;

  private anchors: (Position | undefined)[] = [];
  private records: StepRecord[] = [];
  private mistakes = 0;
  private advanceInMs = 0;
  private flashMsLeft = 0;
  private recentKinds: string[] = [];
  private recentStages: StageId[] = [];
  private lastConcepts: string[] = [];
  private sessionMisses: Record<string, number> = {};
  private challengeTotalMs = 0;
  private hintLevel = 0;
  /** Hints or note-reveal were used in the current challenge. */
  private assisted = false;
  private nextChallengeId = 1;

  constructor(opts: GameOptions) {
    this.srs = opts.initial.srs;
    this.progress = opts.initial.progress;
    this.bestScore = opts.initial.bestScore;
    this.rng = opts.rng;
    this.save = opts.save;
    this.unlockAll = !!opts.unlockAll;
    this.s = this.blank({ mode: 'mix', minutes: 5 });
    this.snap = { ...this.s };
  }

  // ---- external store plumbing -------------------------------------------------
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): Snapshot => this.snap;
  private emit() {
    this.snap = { ...this.s, levels: this.levels(), bestScore: this.bestScore };
    this.listeners.forEach((l) => l());
  }

  private levels(): Record<StageId, number> {
    return { notes: this.progress.notes.level, intervals: this.progress.intervals.level, chords: this.progress.chords.level };
  }

  private blank(config: SessionConfig): Snapshot {
    return {
      phase: 'idle', config, sessionMsLeft: config.minutes * 60000, score: 0, streak: 0, bestStreak: 0,
      lives: MAX_LIVES, total: 0, perfect: 0, challenge: null, stepIndex: 0, progress: null, challengeMsLeft: null,
      revealMsLeft: 0, feedback: null, flash: null, discovery: null, solution: [], levelToast: null, reveal: this.s?.reveal ?? false, hints: [], hintPos: null, hintsDone: false, summary: null,
      levels: this.levels(), bestScore: this.bestScore,
    };
  }

  isUnlocked(stage: StageId): boolean {
    return isUnlocked(this.progress, stage, this.unlockAll);
  }

  // ---- session lifecycle -------------------------------------------------------
  start(config: SessionConfig) {
    this.s = this.blank(config);
    this.anchors = [];
    this.records = [];
    this.mistakes = 0;
    this.advanceInMs = 0;
    this.flashMsLeft = 0;
    this.recentKinds = [];
    this.recentStages = [];
    this.lastConcepts = [];
    this.sessionMisses = {};
    this.s.phase = 'playing';
    this.loadNext();
    this.emit();
  }

  home() {
    this.s = this.blank(this.s.config);
    this.emit();
  }

  resetProgress(progress: Progress, srs: SrsState) {
    this.progress = progress;
    this.srs = srs;
    this.bestScore = 0;
    this.persist();
    this.home();
  }

  quit() {
    if (this.s.phase === 'playing' || this.s.phase === 'discovery') this.endSession('quit');
  }

  private endSession(reason: Summary['reason']) {
    const newBest = this.s.score > this.bestScore;
    if (newBest) this.bestScore = this.s.score;
    this.s.summary = {
      total: this.s.total,
      perfect: this.s.perfect,
      bestStreak: this.s.bestStreak,
      score: this.s.score,
      tip: this.practiceTip(),
      reason,
      newBest,
    };
    this.s.phase = 'summary';
    this.s.challenge = null;
    this.s.discovery = null;
    this.s.feedback = null;
    this.s.solution = [];
    this.persist();
    this.emit();
  }

  private practiceTip(): string {
    if (this.s.total === 0) return 'Juega un poco más para saber qué reforzar.';
    const worst = Object.entries(this.sessionMisses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => conceptLabel(k));
    if (!worst.length) return 'Sin puntos débiles claros. Sigue subiendo de nivel.';
    return `Practica más: ${worst.join(' y ')}.`;
  }

  private persist() {
    this.save?.({ srs: this.srs, progress: this.progress, bestScore: this.bestScore });
  }

  // ---- challenge flow ----------------------------------------------------------
  private pickStage(): StageId {
    const mode = this.s.config.mode;
    if (mode !== 'mix') return mode;
    const unlocked = STAGES.filter((st) => this.isUnlocked(st.id));
    const last = this.recentStages.slice(-2);
    return weightedPick(this.rng, unlocked, (st) => {
      const weak = averageWeakness(this.srs, st.concepts(this.progress[st.id].level));
      const repeated = last.length === 2 && last.every((x) => x === st.id) ? 0.15 : 1;
      return (0.5 + weak) * repeated;
    }).id;
  }

  private loadNext() {
    const stage = this.pickStage();
    const ch = generateChallenge({
      stage,
      level: this.progress[stage].level,
      srs: this.srs,
      rng: this.rng,
      id: this.nextChallengeId++,
      recentKinds: this.recentKinds,
      avoidConcepts: this.lastConcepts,
    });
    this.recentKinds.push(ch.kind);
    this.recentStages.push(stage);
    this.lastConcepts = ch.concepts;
    this.s.challenge = ch;
    this.anchors = [];
    this.records = [];
    this.mistakes = 0;
    this.s.discovery = null;
    this.s.solution = [];
    this.s.feedback = null;
    this.challengeTotalMs = ch.timeLimitMs ?? 0;
    this.s.challengeMsLeft = ch.timeLimitMs ?? null;
    this.assisted = this.s.reveal;
    this.beginStep(0);
  }

  private ctx(): EvalContext {
    return { anchors: this.anchors };
  }

  private beginStep(i: number) {
    const ch = this.s.challenge!;
    const step = ch.steps[i];
    this.s.stepIndex = i;
    this.s.progress = initProgress(step.spec, this.ctx());
    this.s.revealMsLeft = step.reveal?.ms ?? 0;
    this.resetHints();
  }

  private resetHints() {
    this.hintLevel = 0;
    this.s.hints = [];
    this.s.hintPos = null;
    this.s.hintsDone = false;
  }

  setReveal(on: boolean) {
    this.s.reveal = on;
    if (on && this.s.phase === 'playing') this.assisted = true;
    this.emit();
  }

  /** Next progressive hint for the current step. */
  hint() {
    const s = this.s;
    if (s.phase !== 'playing' || !s.challenge || !s.progress || this.advanceInMs > 0 || s.revealMsLeft > 0) return;
    const spec = s.challenge.steps[s.stepIndex].spec;
    const h = hintFor(spec, s.progress, this.ctx(), this.hintLevel);
    if (!h) return;
    this.assisted = true;
    this.hintLevel++;
    s.hints = [...s.hints, h.text];
    if (h.pos) s.hintPos = h.pos;
    s.hintsDone = !hintFor(spec, s.progress, this.ctx(), this.hintLevel);
    this.emit();
  }

  private say(kind: Feedback['kind'], text: string) {
    this.s.feedback = text ? { id: this.uid++, kind, text } : null;
  }

  click(pos: Position) {
    const s = this.s;
    if (s.phase !== 'playing' || !s.challenge || !s.progress || this.advanceInMs > 0 || s.revealMsLeft > 0) return;
    const step = s.challenge.steps[s.stepIndex];
    const r = evaluateClick(step.spec, s.progress, pos, this.ctx());
    this.handleResult(r.outcome, r.message, r.progress, r.complete, pos);
  }

  choose(index: number) {
    const s = this.s;
    if (s.phase !== 'playing' || !s.challenge || !s.progress || this.advanceInMs > 0) return;
    const step = s.challenge.steps[s.stepIndex];
    const r = evaluateChoice(step.spec, s.progress, index);
    this.handleResult(r.outcome, r.message, r.progress, r.complete);
  }

  private handleResult(outcome: string, message: string, progress: StepProgress, complete: boolean, pos?: Position) {
    const s = this.s;
    s.progress = progress;
    if (outcome === 'ignored' || outcome === 'info') {
      this.say('info', message);
      this.emit();
      return;
    }
    if (outcome === 'wrong') {
      this.mistakes++;
      s.streak = 0;
      s.lives--;
      if (pos) {
        s.flash = { id: this.uid++, pos };
        this.flashMsLeft = FLASH_MS;
      }
      for (const c of s.challenge!.concepts) this.sessionMisses[c] = (this.sessionMisses[c] ?? 0) + 1;
      this.say('bad', message);
      if (s.lives <= 0) return this.failChallenge(true);
      if (this.mistakes >= MAX_MISTAKES_PER_CHALLENGE) return this.failChallenge(false);
      this.emit();
      return;
    }
    // correct
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.score += Math.round(10 * (1 + Math.min(s.streak, 30) / 10));
    if (s.streak % STREAK_PER_LIFE === 0 && s.lives < MAX_LIVES) s.lives++;
    this.say('ok', message);
    if (!complete) this.resetHints();
    if (complete) this.completeStep();
    this.emit();
  }

  private completeStep() {
    const s = this.s;
    const ch = s.challenge!;
    const step = ch.steps[s.stepIndex];
    this.records[s.stepIndex] = { spec: step.spec, progress: s.progress! };
    this.anchors[s.stepIndex] = stepAnchor(s.progress!);
    if (s.stepIndex + 1 < ch.steps.length) {
      this.beginStep(s.stepIndex + 1);
      return;
    }
    this.finishChallenge(this.mistakes === 0 ? 'perfect' : 'ok');
  }

  private failChallenge(outOfLives: boolean) {
    const s = this.s;
    const ch = s.challenge!;
    const step = ch.steps[s.stepIndex];
    const sol = autoSolve(step.spec, s.progress!, this.ctx(), 3);
    // replay the solution to know the final state of the step (for the explanation)
    let prog = s.progress!;
    for (const p of sol) prog = evaluateClick(step.spec, prog, p, this.ctx()).progress;
    if (step.spec.type === 'choice') prog = { type: 'choice', picked: step.spec.options.indexOf(step.spec.answer) };
    this.records[s.stepIndex] = { spec: step.spec, progress: prog };
    s.solution = step.spec.type === 'choice' ? [] : sol;
    this.finishChallenge('fail', outOfLives);
  }

  /** Timeout and "rendirse" lose a life like a mistake would. */
  private loseLife(): boolean {
    this.s.streak = 0;
    this.s.lives--;
    for (const c of this.s.challenge!.concepts) this.sessionMisses[c] = (this.sessionMisses[c] ?? 0) + 1;
    return this.s.lives <= 0;
  }

  skip() {
    const s = this.s;
    if (s.phase !== 'playing' || !s.challenge || this.advanceInMs > 0 || s.revealMsLeft > 0) return;
    this.say('info', '');
    this.failChallenge(this.loseLife());
  }

  private finishChallenge(outcomeIn: Outcome, outOfLives = false) {
    const s = this.s;
    // using hints or the note reveal means it was not a clean solve
    const outcome: Outcome = this.assisted && outcomeIn === 'perfect' ? 'ok' : outcomeIn;
    const ch = s.challenge!;
    s.total++;
    if (outcome === 'perfect') s.perfect++;
    if (outcome !== 'fail') {
      const timeBonus = s.challengeMsLeft !== null && this.challengeTotalMs ? Math.round((s.challengeMsLeft / this.challengeTotalMs) * 40) : 0;
      s.score += 40 + (outcome === 'perfect' ? 30 : 0) + timeBonus;
    }
    this.srs = recordResult(this.srs, ch.concepts, outcome);
    const res = applyOutcome(this.progress, ch.stage, outcome);
    this.progress = res.progress;
    if (res.change) {
      const name = STAGES.find((x) => x.id === ch.stage)!.mode;
      const lvl = this.progress[ch.stage].level;
      s.levelToast = { id: this.uid++, text: res.change === 'up' ? `${name}: nivel ${lvl}` : `${name}: bajamos a nivel ${lvl}` };
    }
    this.persist();

    if (outOfLives) {
      this.endSession('lives');
      return;
    }
    const disc = buildDiscovery(this.records, outcome === 'fail');
    if (disc) {
      s.discovery = disc;
      s.phase = 'discovery';
      s.challengeMsLeft = null;
    } else {
      this.advanceInMs = ADVANCE_MS;
    }
    this.emit();
  }

  /** Leaves the explanation card and moves on. */
  next() {
    if (this.s.phase !== 'discovery') return;
    this.s.phase = 'playing';
    this.loadNext();
    this.emit();
  }

  // ---- clock -------------------------------------------------------------------
  tick(dt: number) {
    const s = this.s;
    if (s.phase !== 'playing') return;
    s.sessionMsLeft -= dt;
    if (s.sessionMsLeft <= 0) {
      s.sessionMsLeft = 0;
      this.endSession('time');
      return;
    }
    if (this.flashMsLeft > 0) {
      this.flashMsLeft -= dt;
      if (this.flashMsLeft <= 0) s.flash = null;
    }
    if (this.advanceInMs > 0) {
      this.advanceInMs -= dt;
      if (this.advanceInMs <= 0) {
        this.advanceInMs = 0;
        this.loadNext();
      }
    } else if (s.revealMsLeft > 0) {
      s.revealMsLeft = Math.max(0, s.revealMsLeft - dt);
    } else if (s.challengeMsLeft !== null) {
      s.challengeMsLeft -= dt;
      if (s.challengeMsLeft <= 0) {
        s.challengeMsLeft = 0;
        this.say('bad', '⏱ Se acabó el tiempo');
        this.failChallenge(this.loseLife());
        return;
      }
    }
    this.emit();
  }
}

export function conceptLabel(key: string): string {
  const [kind, a, b] = key.split(':');
  if (kind === 'note') return a;
  if (kind === 'int') return intervalName(Number(a));
  if (kind === 'chord') return `${noteName(parseNote(a))} ${CHORD_FORMULAS[b as ChordQuality].name}`;
  return key;
}

export const levelFretMax = (level: number) => levelDef(level).fretMax;
