import type { LibraryQuality, PitchClass } from '../theory';
import type { Frets } from './voicings';

export interface SongChord {
  id: string;
  root: PitchClass;
  quality: LibraryQuality;
  frets: Frets;
}

export interface SongRow {
  id: string;
  label: string;
  chords: SongChord[];
}

export interface Song {
  id: string;
  name: string;
  rows: SongRow[];
}

export interface SongStore {
  songs: Song[];
  currentId: string;
}

const KEY = 'fretquest:songs:v1';

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const newRow = (label = 'Fila'): SongRow => ({ id: uid(), label, chords: [] });
export const newSong = (name = 'Mi canción'): Song => ({ id: uid(), name, rows: [newRow('Fila 1')] });

export function emptyStore(): SongStore {
  const s = newSong();
  return { songs: [s], currentId: s.id };
}

export function loadSongs(): SongStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const p = JSON.parse(raw) as SongStore;
    if (!Array.isArray(p.songs) || p.songs.length === 0) return emptyStore();
    return { songs: p.songs, currentId: p.songs.some((s) => s.id === p.currentId) ? p.currentId : p.songs[0].id };
  } catch {
    return emptyStore();
  }
}

export function saveSongs(store: SongStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable: songs just aren't kept */
  }
}

// ---- pure editing helpers (each returns a new Song) -------------------------------------

const mapRows = (song: Song, fn: (rows: SongRow[]) => SongRow[]): Song => ({ ...song, rows: fn(song.rows) });
const mapRow = (song: Song, rowId: string, fn: (row: SongRow) => SongRow): Song =>
  mapRows(song, (rows) => rows.map((r) => (r.id === rowId ? fn(r) : r)));

export const addChord = (song: Song, rowId: string, chord: SongChord): Song =>
  mapRow(song, rowId, (r) => ({ ...r, chords: [...r.chords, chord] }));

export const removeChord = (song: Song, chordId: string): Song =>
  mapRows(song, (rows) => rows.map((r) => ({ ...r, chords: r.chords.filter((c) => c.id !== chordId) })));

export const duplicateChord = (song: Song, chordId: string): Song =>
  mapRows(song, (rows) =>
    rows.map((r) => {
      const i = r.chords.findIndex((c) => c.id === chordId);
      if (i < 0) return r;
      const copy = { ...r.chords[i], id: uid() };
      return { ...r, chords: [...r.chords.slice(0, i + 1), copy, ...r.chords.slice(i + 1)] };
    }),
  );

/** Moves a chord one place left (-1) or right (+1) inside its row. */
export function moveChord(song: Song, chordId: string, delta: -1 | 1): Song {
  return mapRows(song, (rows) =>
    rows.map((r) => {
      const i = r.chords.findIndex((c) => c.id === chordId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= r.chords.length) return r;
      const chords = [...r.chords];
      [chords[i], chords[j]] = [chords[j], chords[i]];
      return { ...r, chords };
    }),
  );
}

/** Moves a chord to the previous (-1) or next (+1) row, appending it at the end. */
export function moveChordToRow(song: Song, chordId: string, delta: -1 | 1): Song {
  const from = song.rows.findIndex((r) => r.chords.some((c) => c.id === chordId));
  const to = from + delta;
  if (from < 0 || to < 0 || to >= song.rows.length) return song;
  const chord = song.rows[from].chords.find((c) => c.id === chordId)!;
  return mapRows(song, (rows) =>
    rows.map((r, i) => {
      if (i === from) return { ...r, chords: r.chords.filter((c) => c.id !== chordId) };
      if (i === to) return { ...r, chords: [...r.chords, chord] };
      return r;
    }),
  );
}

export const addRow = (song: Song): Song => mapRows(song, (rows) => [...rows, newRow(`Fila ${rows.length + 1}`)]);

export const removeRow = (song: Song, rowId: string): Song => mapRows(song, (rows) => rows.filter((r) => r.id !== rowId));

export const renameRow = (song: Song, rowId: string, label: string): Song => mapRow(song, rowId, (r) => ({ ...r, label }));

export function moveRow(song: Song, rowId: string, delta: -1 | 1): Song {
  return mapRows(song, (rows) => {
    const i = rows.findIndex((r) => r.id === rowId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= rows.length) return rows;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
}
