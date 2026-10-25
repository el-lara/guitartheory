import { describe, expect, it } from 'vitest';
import {
  addItem,
  addItems,
  addRow,
  duplicateItem,
  itemLabel,
  itemText,
  moveItem,
  moveItemToRow,
  moveRow,
  newSong,
  normalizeStore,
  removeItem,
  replaceItem,
  removeRow,
  renameRow,
  updateItem,
  type SongChord,
  type SongScale,
} from './songs';

const ch = (id: string): SongChord => ({ kind: 'chord', id, root: 0, quality: 'maj', frets: [-1, 3, 2, 0, 1, 0] });
const sc = (id: string): SongScale => ({ kind: 'scale', id, tonic: 9, type: 'pentatonicMinor', box: 5 });
const ids = (s: ReturnType<typeof newSong>, row = 0) => s.rows[row].items.map((c) => c.id);

describe('song editing', () => {
  it('adds, orders and removes items inside a row', () => {
    let s = newSong();
    const row = s.rows[0].id;
    for (const id of ['a', 'b', 'c']) s = addItem(s, row, ch(id));
    expect(ids(s)).toEqual(['a', 'b', 'c']);
    s = moveItem(s, 'c', -1);
    expect(ids(s)).toEqual(['a', 'c', 'b']);
    s = moveItem(s, 'a', -1); // already first: unchanged
    expect(ids(s)).toEqual(['a', 'c', 'b']);
    s = removeItem(s, 'c');
    expect(ids(s)).toEqual(['a', 'b']);
    s = duplicateItem(s, 'a');
    expect(s.rows[0].items).toHaveLength(3);
    expect(s.rows[0].items[1].id).not.toBe('a');
    expect(s.rows[0].items[1]).toMatchObject({ kind: 'chord', frets: ch('a').frets });
  });
  it('moves items between rows and orders rows', () => {
    let s = newSong();
    s = addRow(s);
    const [r1, r2] = s.rows.map((r) => r.id);
    s = addItem(s, r1, ch('a'));
    s = addItem(s, r1, ch('b'));
    s = moveItemToRow(s, 'a', 1);
    expect(ids(s, 0)).toEqual(['b']);
    expect(ids(s, 1)).toEqual(['a']);
    s = moveItemToRow(s, 'a', 1); // last row: unchanged
    expect(ids(s, 1)).toEqual(['a']);
    s = moveRow(s, r2, -1);
    expect(s.rows.map((r) => r.id)).toEqual([r2, r1]);
    s = renameRow(s, r1, 'Estribillo');
    expect(s.rows[1].label).toBe('Estribillo');
    s = removeRow(s, r2);
    expect(s.rows).toHaveLength(1);
  });
});

describe('scales inside rows', () => {
  it('mixes chords and scales, and edits a scale in place', () => {
    let s = newSong();
    const row = s.rows[0].id;
    s = addItem(s, row, ch('a'));
    s = addItem(s, row, sc('s'));
    expect(s.rows[0].items.map((i) => i.kind)).toEqual(['chord', 'scale']);
    expect(itemLabel(sc('s'))).toBe('A pent. menor');
    expect(itemText(sc('s'))).toBe('A pent. menor (caja 5–9)');
    // edit: change tonic, type and drop the box; position in the row is kept
    s = updateItem(s, 's', (it) => (it.kind === 'scale' ? { ...it, tonic: 0, type: 'major', box: null } : it));
    expect(ids(s)).toEqual(['a', 's']);
    expect(s.rows[0].items[1]).toMatchObject({ kind: 'scale', tonic: 0, type: 'major', box: null });
    expect(itemText(s.rows[0].items[1])).toBe('C mayor');
    // scales travel between rows like chords do
    s = addRow(s);
    s = moveItemToRow(s, 's', 1);
    expect(ids(s, 1)).toEqual(['s']);
  });
  it('edits a chord in place', () => {
    let s = newSong();
    s = addItem(s, s.rows[0].id, ch('a'));
    s = updateItem(s, 'a', (it) => (it.kind === 'chord' ? { ...it, root: 9, quality: 'min', frets: [-1, 0, 2, 2, 1, 0] } : it));
    expect(itemLabel(s.rows[0].items[0])).toBe('Am');
  });
});

describe('scale to chords', () => {
  it('adds several items at once and replaces a scale by chords in place', () => {
    let s = newSong();
    const row = s.rows[0].id;
    s = addItem(s, row, ch('a'));
    s = addItem(s, row, sc('s'));
    s = addItem(s, row, ch('z'));
    s = replaceItem(s, 's', [ch('x'), ch('y')]);
    expect(ids(s)).toEqual(['a', 'x', 'y', 'z']);
    s = addItems(s, row, [ch('p'), ch('q')]);
    expect(ids(s)).toEqual(['a', 'x', 'y', 'z', 'p', 'q']);
  });
});

describe('stored songs migration', () => {
  it('upgrades rows saved with the first format (chords only)', () => {
    const old = {
      currentId: 's1',
      songs: [{ id: 's1', name: 'Vieja', rows: [{ id: 'r1', label: 'Fila 1', chords: [{ id: 'c1', root: 0, quality: 'maj', frets: [-1, 3, 2, 0, 1, 0] }] }] }],
    };
    const s = normalizeStore(old);
    expect(s.songs[0].rows[0].items).toEqual([{ kind: 'chord', id: 'c1', root: 0, quality: 'maj', frets: [-1, 3, 2, 0, 1, 0] }]);
    expect(normalizeStore(null).songs).toHaveLength(1);
    expect(normalizeStore({ songs: [], currentId: 'x' }).songs).toHaveLength(1);
  });
});
