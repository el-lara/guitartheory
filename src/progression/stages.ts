import { CHORD_QUALITIES, NATURAL_PCS, NOTE_NAMES, type ChordQuality, type PitchClass } from '../theory';

export type StageId = 'notes' | 'intervals' | 'chords';

/** Difficulty parameters shared by every stage. Derived from skill level, not from a fixed curriculum. */
export interface LevelDef {
  level: number;
  fretMax: number;
  /** Probability that a time-capable challenge gets a countdown. */
  timedChance: number;
  /** Time budget (ms) for one click-sized task; scaled by the generator. */
  baseTimeMs: number;
}

export const MAX_LEVEL = 5;

export const LEVELS: LevelDef[] = [
  { level: 1, fretMax: 5, timedChance: 0, baseTimeMs: 0 },
  { level: 2, fretMax: 7, timedChance: 0.15, baseTimeMs: 12000 },
  { level: 3, fretMax: 9, timedChance: 0.3, baseTimeMs: 9000 },
  { level: 4, fretMax: 12, timedChance: 0.4, baseTimeMs: 7000 },
  { level: 5, fretMax: 12, timedChance: 0.5, baseTimeMs: 5500 },
];

export const levelDef = (level: number): LevelDef => LEVELS[Math.min(MAX_LEVEL, Math.max(1, level)) - 1];

export interface StageDef {
  id: StageId;
  name: string;
  mode: string;
  tagline: string;
  /** Stage that must reach `unlockLevel` first. */
  requires?: { stage: StageId; level: number };
  /** Concept keys (for repetition) that make up this stage at a given level. */
  concepts: (level: number) => string[];
}

const pcName = (pc: PitchClass) => NOTE_NAMES[pc];

export const noteKey = (pc: PitchClass) => `note:${pcName(pc)}`;
export const intervalKey = (semitones: number) => `int:${semitones}`;
export const chordKey = (root: PitchClass, q: ChordQuality) => `chord:${pcName(root)}:${q}`;

const NOTE_POOLS: PitchClass[][] = [
  [4, 9, 2, 7, 11], // E A D G B — the open strings
  NATURAL_PCS,
  [...Array(12).keys()],
];
export const notePool = (level: number): PitchClass[] => NOTE_POOLS[Math.min(2, level - 1)];

const INTERVAL_POOLS: number[][] = [
  [7, 12, 4], // 5J, 8J, 3M
  [7, 12, 4, 3, 5], // + 3m, 4J
  [7, 12, 4, 3, 5, 2, 9, 10],
  [7, 12, 4, 3, 5, 2, 9, 10, 1, 8, 11],
  [7, 12, 4, 3, 5, 2, 9, 10, 1, 8, 11, 6],
];
export const intervalPool = (level: number): number[] => INTERVAL_POOLS[Math.min(5, level) - 1];

export function chordPool(level: number): { root: PitchClass; quality: ChordQuality }[] {
  const pool: { root: PitchClass; quality: ChordQuality }[] = [];
  const roots: PitchClass[] = level <= 1 ? [0, 7, 2, 9, 4] : level === 2 ? [0, 7, 2, 9, 4, 5] : level === 3 ? NATURAL_PCS : [...Array(12).keys()];
  const qualities: ChordQuality[] = level <= 1 ? ['maj'] : CHORD_QUALITIES;
  for (const root of roots) for (const quality of qualities) pool.push({ root, quality });
  return pool;
}

/** Registry of stages. Adding "Escalas" or "Armonía" means appending an entry here + its generators. */
export const STAGES: StageDef[] = [
  {
    id: 'notes',
    name: 'Cazador de notas',
    mode: 'Mástil',
    tagline: 'Aprende dónde vive cada nota',
    concepts: (l) => notePool(l).map(noteKey),
  },
  {
    id: 'intervals',
    name: 'Cazador de intervalos',
    mode: 'Distancias',
    tagline: 'Descubre las distancias entre notas',
    requires: { stage: 'notes', level: 2 },
    concepts: (l) => intervalPool(l).map(intervalKey),
  },
  {
    id: 'chords',
    name: 'Constructor de acordes',
    mode: 'Tríadas',
    tagline: 'Construye acordes nota a nota',
    requires: { stage: 'intervals', level: 2 },
    concepts: (l) => chordPool(l).map((c) => chordKey(c.root, c.quality)),
  },
];

export const stageById = (id: StageId): StageDef => STAGES.find((s) => s.id === id)!;
