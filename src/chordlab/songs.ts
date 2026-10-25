import { BOX_SPAN } from '../fretboard/scaleBox';
import { noteName, type LibraryQuality, type PitchClass, type ScaleType } from '../theory';
import { voicingSymbol, type Frets } from './voicings';

export interface SongChord {
  kind: 'chord';
  id: string;
  root: PitchClass;
  quality: LibraryQuality;
  frets: Frets;
}

export interface SongScale {
  kind: 'scale';
  id: string;
  tonic: PitchClass;
  type: ScaleType;
  /** First fret of the 5-fret box, or null to show the whole neck. */
  box: number | null;
}

/** A row holds chords and scales in the order they are played/studied. */
export type SongItem = SongChord | SongScale;

export interface SongRow {
  id: string;
  label: string;
  items: SongItem[];
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

export const newRow = (label = 'Fila'): SongRow => ({ id: uid(), label, items: [] });
export const newSong = (name = 'Mi canción'): Song => ({ id: uid(), name, rows: [newRow('Fila 1')] });

export function emptyStore(): SongStore {
  const s = newSong();
  return { songs: [s], currentId: s.id };
}

/** Accepts any stored shape (including the first version, where rows held only `chords`). */
export function normalizeStore(raw: unknown): SongStore {
  const p = raw as { songs?: unknown[]; currentId?: string } | null;
  if (!p || !Array.isArray(p.songs) || p.songs.length === 0) return emptyStore();
  const songs: Song[] = p.songs.map((sv) => {
    const so = sv as { id?: string; name?: string; rows?: unknown[] };
    const rows: SongRow[] = (so.rows ?? []).map((rv) => {
      const ro = rv as { id?: string; label?: string; items?: SongItem[]; chords?: SongItem[] };
      const items = (ro.items ?? ro.chords ?? []).map((it) => ({ ...it, kind: (it as SongItem).kind ?? 'chord' }) as SongItem);
      return { id: ro.id ?? uid(), label: ro.label ?? 'Fila', items };
    });
    return { id: so.id ?? uid(), name: so.name ?? 'Mi canción', rows: rows.length ? rows : [newRow('Fila 1')] };
  });
  return { songs, currentId: songs.some((x) => x.id === p.currentId) ? p.currentId! : songs[0].id };
}

export function loadSongs(): SongStore {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeStore(JSON.parse(raw)) : emptyStore();
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

export const addItem = (song: Song, rowId: string, item: SongItem): Song =>
  mapRow(song, rowId, (r) => ({ ...r, items: [...r.items, item] }));

export const removeItem = (song: Song, itemId: string): Song =>
  mapRows(song, (rows) => rows.map((r) => ({ ...r, items: r.items.filter((c) => c.id !== itemId) })));

/** Replaces one item with the result of `fn` (used by the in-place editors). */
export const updateItem = (song: Song, itemId: string, fn: (item: SongItem) => SongItem): Song =>
  mapRows(song, (rows) => rows.map((r) => ({ ...r, items: r.items.map((it) => (it.id === itemId ? fn(it) : it)) })));

export const duplicateItem = (song: Song, itemId: string): Song =>
  mapRows(song, (rows) =>
    rows.map((r) => {
      const i = r.items.findIndex((c) => c.id === itemId);
      if (i < 0) return r;
      const copy = { ...r.items[i], id: uid() };
      return { ...r, items: [...r.items.slice(0, i + 1), copy, ...r.items.slice(i + 1)] };
    }),
  );

/** Moves an item one place left (-1) or right (+1) inside its row. */
export function moveItem(song: Song, itemId: string, delta: -1 | 1): Song {
  return mapRows(song, (rows) =>
    rows.map((r) => {
      const i = r.items.findIndex((c) => c.id === itemId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= r.items.length) return r;
      const items = [...r.items];
      [items[i], items[j]] = [items[j], items[i]];
      return { ...r, items };
    }),
  );
}

/** Moves an item to the previous (-1) or next (+1) row, appending it at the end. */
export function moveItemToRow(song: Song, itemId: string, delta: -1 | 1): Song {
  const from = song.rows.findIndex((r) => r.items.some((c) => c.id === itemId));
  const to = from + delta;
  if (from < 0 || to < 0 || to >= song.rows.length) return song;
  const item = song.rows[from].items.find((c) => c.id === itemId)!;
  return mapRows(song, (rows) =>
    rows.map((r, i) => {
      if (i === from) return { ...r, items: r.items.filter((c) => c.id !== itemId) };
      if (i === to) return { ...r, items: [...r.items, item] };
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

// ---- labels --------------------------------------------------------------------------------

const SCALE_SHORT: Record<ScaleType, string> = {
  major: 'mayor',
  naturalMinor: 'menor',
  pentatonicMajor: 'pent. mayor',
  pentatonicMinor: 'pent. menor',
  blues: 'blues',
};

/** "Am", "C/E" for chords; "A pent. menor" for scales. */
export function itemLabel(item: SongItem): string {
  return item.kind === 'chord' ? voicingSymbol(item.root, item.quality, item.frets) : `${noteName(item.tonic)} ${SCALE_SHORT[item.type]}`;
}

/** Label plus the box position, used in copied text. */
export function itemText(item: SongItem): string {
  if (item.kind === 'chord') return itemLabel(item);
  return item.box === null ? itemLabel(item) : `${itemLabel(item)} (caja ${item.box}–${item.box + BOX_SPAN})`;
}
