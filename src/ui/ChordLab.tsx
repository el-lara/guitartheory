import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../audio/webAudio';
import {
  addChord,
  addRow,
  duplicateChord,
  loadSongs,
  moveChord,
  moveChordToRow,
  moveRow,
  newSong,
  removeChord,
  removeRow,
  renameRow,
  saveSongs,
  uid,
  type Song,
  type SongChord,
  type SongStore,
} from '../chordlab/songs';
import { fretsMidi, fretsText, inversionOf, searchVoicings, stringPc, voicingSymbol, type Frets } from '../chordlab/voicings';
import {
  CHORD_LIBRARY,
  libraryChordName,
  libraryPcs,
  LIBRARY_QUALITIES,
  noteName,
  NOTE_NAMES,
  type LibraryQuality,
  type PitchClass,
} from '../theory';
import { ChordDiagram } from './ChordDiagram';
import { Fretboard, type Marker, type MarkerKind } from './Fretboard';
import { positionMidi } from '../fretboard/fretboard';

const TONE_KINDS: MarkerKind[] = ['deg1', 'deg3', 'deg5', 'target'];

function markersFor(root: PitchClass, quality: LibraryQuality, frets: Frets): Marker[] {
  const pcs = libraryPcs(root, quality);
  return frets.map((f, s) => {
    if (f < 0) return { pos: { string: s, fret: 0 }, kind: 'dim' as const, label: '×' };
    const pc = stringPc(s, f);
    return { pos: { string: s, fret: f }, kind: TONE_KINDS[pcs.indexOf(pc)] ?? 'found', label: noteName(pc) };
  });
}

const playFrets = (frets: Frets) => audio.playChord(fretsMidi(frets));

export function ChordLab({ onBack }: { onBack: () => void }) {
  const [root, setRoot] = useState(0);
  const [quality, setQuality] = useState<LibraryQuality>('maj');
  const [inv, setInv] = useState(0);
  const [vIdx, setVIdx] = useState(0);
  const [store, setStore] = useState<SongStore>(loadSongs);
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => saveSongs(store), [store]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const song = store.songs.find((s) => s.id === store.currentId)!;
  const updateSong = (fn: (s: Song) => Song) =>
    setStore((st) => ({ ...st, songs: st.songs.map((s) => (s.id === st.currentId ? fn(s) : s)) }));

  const groups = useMemo(() => searchVoicings(root, quality), [root, quality]);
  const group = groups.find((g) => g.inversion === inv) ?? groups[0];
  const voicing = group.voicings[Math.min(vIdx, group.voicings.length - 1)];

  const selectedChord = song.rows.flatMap((r) => r.chords).find((c) => c.id === selected) ?? null;
  const shown = selectedChord
    ? { root: selectedChord.root, quality: selectedChord.quality, frets: selectedChord.frets }
    : { root, quality, frets: voicing.frets };
  const shownPcs = libraryPcs(shown.root, shown.quality);
  const shownInv = inversionOf(shown.root, shown.quality, shown.frets);
  const bassPc = shown.frets.findIndex((f) => f >= 0);

  const pick = (fn: () => void) => {
    setSelected(null);
    fn();
  };
  const targetRow = song.rows.find((r) => r.id === activeRow) ?? song.rows[song.rows.length - 1];

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlayingId(null);
  };
  const playChords = (chords: SongChord[]) => {
    stop();
    chords.forEach((c, i) => {
      timers.current.push(window.setTimeout(() => { setPlayingId(c.id); playFrets(c.frets); }, i * 1100));
    });
    timers.current.push(window.setTimeout(() => setPlayingId(null), chords.length * 1100));
  };

  const songText = [song.name, ...song.rows.map((r) => `${r.label}: ${r.chords.map((c) => voicingSymbol(c.root, c.quality, c.frets)).join(' | ')}`)].join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(songText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copia el texto:', songText);
    }
  };

  return (
    <div className="lessons chordlab">
      <header className="lessons-head">
        <button className="ghost" onClick={onBack}>‹ Menú</button>
        <h1>Acordes y canciones</h1>
        <span />
      </header>

      <div className="chips-row" role="group" aria-label="Raíz">
        {NOTE_NAMES.map((nm, pc) => (
          <button key={nm} className={`pill${!selectedChord && pc === root ? ' sel' : ''}`} onClick={() => pick(() => { setRoot(pc); setInv(0); setVIdx(0); })}>{nm}</button>
        ))}
      </div>
      <div className="chips-row" role="group" aria-label="Tipo de acorde">
        {LIBRARY_QUALITIES.map((q) => (
          <button key={q} className={`pill wide${!selectedChord && q === quality ? ' sel' : ''}`} onClick={() => pick(() => { setQuality(q); setInv(0); setVIdx(0); })}>
            {CHORD_LIBRARY[q].name}
          </button>
        ))}
      </div>

      <Fretboard fretMax={12} markers={markersFor(shown.root, shown.quality, shown.frets)} onPlay={(p) => audio.playNote(positionMidi(p))} />

      <div className="lesson-card chord-info">
        <div className="chord-title">
          <h2>{libraryChordName(shown.root, shown.quality)}</h2>
          <span className="symbol">{voicingSymbol(shown.root, shown.quality, shown.frets)}</span>
        </div>
        <div className="formula">
          {shownPcs.map((pc, i) => (
            <span key={i} className={`tone ${TONE_KINDS[i] === 'target' ? 'deg7' : TONE_KINDS[i]}`}><b>{noteName(pc)}</b><small>{CHORD_LIBRARY[shown.quality].degrees[i]}</small></span>
          ))}
        </div>
        <p>
          Forma <b>{fretsText(shown.frets)}</b> (× = cuerda muda, 0 = al aire). Bajo: <b>{noteName(stringPc(bassPc, shown.frets[bassPc]))}</b>
          {shownInv <= 0 ? ' → posición fundamental.' : ` → ${shownInv}ª inversión: el acorde es el mismo, pero la nota más grave es la ${shownInv === 1 ? 'tercera' : shownInv === 2 ? 'quinta' : 'séptima'}.`}
        </p>
        <div className="row">
          <button className="ghost" onClick={() => playFrets(shown.frets)}>🔊 Escuchar</button>
          {!selectedChord && (
            <button className="add-btn" onClick={() => { const c = { id: uid(), root, quality, frets: voicing.frets }; updateSong((s) => addChord(s, targetRow.id, c)); }}>
              ＋ Añadir a «{targetRow.label}»
            </button>
          )}
          {selectedChord && <button className="ghost" onClick={() => setSelected(null)}>← Volver al explorador</button>}
        </div>
      </div>

      {!selectedChord && (
        <div className="voicing-area">
          <div className="chips-row" role="group" aria-label="Inversión">
            {groups.map((g) => (
              <button key={g.inversion} className={`pill wide${g.inversion === group.inversion ? ' sel' : ''}`} onClick={() => { setInv(g.inversion); setVIdx(0); }}>{g.label}</button>
            ))}
          </div>
          <div className="voicings">
            {group.voicings.map((v, i) => (
              <button key={v.frets.join()} className={`voicing${i === vIdx ? ' sel' : ''}`} onClick={() => { setVIdx(i); playFrets(v.frets); }}>
                <ChordDiagram root={root} frets={v.frets} />
                <small>{fretsText(v.frets)}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="songbook">
        <h2>Canciones</h2>
        <div className="song-head">
          <select value={song.id} onChange={(e) => { setStore({ ...store, currentId: e.target.value }); setSelected(null); setActiveRow(null); }} aria-label="Canción">
            {store.songs.map((s) => <option key={s.id} value={s.id}>{s.name || 'Sin nombre'}</option>)}
          </select>
          <input value={song.name} onChange={(e) => updateSong((s) => ({ ...s, name: e.target.value }))} aria-label="Nombre de la canción" placeholder="Nombre" />
          <button className="ghost" onClick={() => { const s = newSong(`Canción ${store.songs.length + 1}`); setStore({ songs: [...store.songs, s], currentId: s.id }); setSelected(null); setActiveRow(null); }}>＋ Nueva</button>
          <button className="ghost" onClick={copy}>{copied ? '✓ Copiado' : '⧉ Copiar texto'}</button>
          <button
            className="ghost"
            disabled={store.songs.length < 2}
            onClick={() => {
              if (!confirm(`¿Borrar «${song.name}»?`)) return;
              const songs = store.songs.filter((s) => s.id !== song.id);
              setStore({ songs, currentId: songs[0].id });
              setSelected(null);
            }}
          >
            🗑 Borrar
          </button>
        </div>

        {song.rows.map((row, ri) => {
          const isActive = targetRow.id === row.id;
          const sel = row.chords.find((c) => c.id === selected);
          return (
            <div key={row.id} className={`song-row${isActive ? ' active' : ''}`} onClick={() => setActiveRow(row.id)}>
              <div className="row-head">
                <input value={row.label} onChange={(e) => updateSong((s) => renameRow(s, row.id, e.target.value))} aria-label="Nombre de la fila" />
                <button className="ghost" disabled={ri === 0} aria-label="Subir fila" onClick={() => updateSong((s) => moveRow(s, row.id, -1))}>↑</button>
                <button className="ghost" disabled={ri === song.rows.length - 1} aria-label="Bajar fila" onClick={() => updateSong((s) => moveRow(s, row.id, 1))}>↓</button>
                <button className="ghost" disabled={!row.chords.length} onClick={() => (playingId ? stop() : playChords(row.chords))}>{playingId ? '■' : '▶ Fila'}</button>
                <button className="ghost" aria-label="Borrar fila" onClick={() => { if (!row.chords.length || confirm('¿Borrar la fila y sus acordes?')) updateSong((s) => removeRow(s, row.id)); }}>🗑</button>
              </div>
              <div className="song-chips">
                {row.chords.length === 0 && <span className="empty">Elige un acorde arriba y pulsa «Añadir».</span>}
                {row.chords.map((c) => (
                  <button key={c.id} className={`song-chip${c.id === selected ? ' sel' : ''}${c.id === playingId ? ' playing' : ''}`} onClick={(e) => { e.stopPropagation(); setSelected(c.id === selected ? null : c.id); setActiveRow(row.id); playFrets(c.frets); }}>
                    <ChordDiagram root={c.root} frets={c.frets} width={64} />
                    <b>{voicingSymbol(c.root, c.quality, c.frets)}</b>
                  </button>
                ))}
              </div>
              {sel && (
                <div className="chip-tools" onClick={(e) => e.stopPropagation()}>
                  <button className="ghost" aria-label="Mover a la izquierda" onClick={() => updateSong((s) => moveChord(s, sel.id, -1))}>‹ Izq.</button>
                  <button className="ghost" aria-label="Mover a la derecha" onClick={() => updateSong((s) => moveChord(s, sel.id, 1))}>Der. ›</button>
                  <button className="ghost" disabled={ri === 0} aria-label="Mover a la fila anterior" onClick={() => updateSong((s) => moveChordToRow(s, sel.id, -1))}>⇡ Fila</button>
                  <button className="ghost" disabled={ri === song.rows.length - 1} aria-label="Mover a la fila siguiente" onClick={() => updateSong((s) => moveChordToRow(s, sel.id, 1))}>⇣ Fila</button>
                  <button className="ghost" onClick={() => updateSong((s) => duplicateChord(s, sel.id))}>⧉ Duplicar</button>
                  <button className="ghost danger" onClick={() => { updateSong((s) => removeChord(s, sel.id)); setSelected(null); }}>✕ Quitar</button>
                </div>
              )}
            </div>
          );
        })}
        <div className="row songbar">
          <button className="ghost" onClick={() => updateSong(addRow)}>＋ Fila</button>
          <button className="ghost" disabled={!song.rows.some((r) => r.chords.length)} onClick={() => (playingId ? stop() : playChords(song.rows.flatMap((r) => r.chords)))}>{playingId ? '■ Parar' : '▶ Tocar canción'}</button>
        </div>
        <p className="lead">Las canciones se guardan en este navegador. Usa «Copiar texto» para llevártelas.</p>
      </section>
    </div>
  );
}
