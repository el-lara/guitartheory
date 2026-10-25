import { describe, expect, it } from 'vitest';
import { addChord, addRow, duplicateChord, moveChord, moveChordToRow, moveRow, newSong, removeChord, removeRow, renameRow, type SongChord } from './songs';

const ch = (id: string): SongChord => ({ id, root: 0, quality: 'maj', frets: [-1, 3, 2, 0, 1, 0] });

describe('song editing', () => {
  it('adds, orders and removes chords inside a row', () => {
    let s = newSong();
    const row = s.rows[0].id;
    for (const id of ['a', 'b', 'c']) s = addChord(s, row, ch(id));
    expect(s.rows[0].chords.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    s = moveChord(s, 'c', -1);
    expect(s.rows[0].chords.map((c) => c.id)).toEqual(['a', 'c', 'b']);
    s = moveChord(s, 'a', -1); // already first: unchanged
    expect(s.rows[0].chords.map((c) => c.id)).toEqual(['a', 'c', 'b']);
    s = removeChord(s, 'c');
    expect(s.rows[0].chords.map((c) => c.id)).toEqual(['a', 'b']);
    s = duplicateChord(s, 'a');
    expect(s.rows[0].chords).toHaveLength(3);
    expect(s.rows[0].chords[1].id).not.toBe('a');
    expect(s.rows[0].chords[1].frets).toEqual(ch('a').frets);
  });
  it('moves chords between rows and orders rows', () => {
    let s = newSong();
    s = addRow(s);
    const [r1, r2] = s.rows.map((r) => r.id);
    s = addChord(s, r1, ch('a'));
    s = addChord(s, r1, ch('b'));
    s = moveChordToRow(s, 'a', 1);
    expect(s.rows[0].chords.map((c) => c.id)).toEqual(['b']);
    expect(s.rows[1].chords.map((c) => c.id)).toEqual(['a']);
    s = moveChordToRow(s, 'a', 1); // last row: unchanged
    expect(s.rows[1].chords.map((c) => c.id)).toEqual(['a']);
    s = moveRow(s, r2, -1);
    expect(s.rows.map((r) => r.id)).toEqual([r2, r1]);
    s = renameRow(s, r1, 'Estribillo');
    expect(s.rows[1].label).toBe('Estribillo');
    s = removeRow(s, r2);
    expect(s.rows).toHaveLength(1);
  });
});
