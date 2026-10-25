import { useEffect, useMemo, useRef, useState } from 'react';
import { audio } from '../audio/webAudio';
import {
  addItem,
  addItems,
  addRow,
  duplicateItem,
  itemLabel,
  itemText,
  loadSongs,
  moveItem,
  moveItemToRow,
  moveRow,
  newSong,
  removeItem,
  removeRow,
  renameRow,
  replaceItem,
  saveSongs,
  uid,
  updateItem,
  type Song,
  type SongChord,
  type SongItem,
  type SongScale,
  type SongStore,
} from '../chordlab/songs';
import { fretsMidi, fretsText, inversionOf, pickVoicing, searchVoicings, stringPc, voicingSymbol, type Frets } from '../chordlab/voicings';
import { BOX_SPAN } from '../fretboard/scaleBox';
import {
  CHORD_LIBRARY,
  libraryChordName,
  libraryPcs,
  LIBRARY_QUALITIES,
  chordSymbol,
  noteName,
  NOTE_NAMES,
  romanNumeral,
  SCALES,
  scaleChords,
  scalePcs,
  scaleSteps,
  type Harmonization,
  type LibraryQuality,
  type PitchClass,
} from '../theory';
import { ChordDiagram } from './ChordDiagram';
import { Fretboard, type Marker, type MarkerKind } from './Fretboard';
import { ScaleDiagram } from './ScaleDiagram';
import { ScalePicker, type ScaleChoice } from './ScalePicker';
import { scaleMarkers } from './scaleMarkers';
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

interface ChordDraft {
  root: PitchClass;
  quality: LibraryQuality;
  frets: Frets;
}

const bestFrets = (root: PitchClass, quality: LibraryQuality, wantInversion: number): Frets => {
  const groups = searchVoicings(root, quality);
  return (groups.find((g) => g.inversion === wantInversion) ?? groups[0]).voicings[0].frets;
};

/** Chords of a scale as song items, each with an easy (or box-near) voicing. */
const chordItemsOf = (scale: ScaleChoice, harm: Harmonization): SongChord[] =>
  scaleChords(scale.tonic, scale.type, harm).map((c) => ({
    kind: 'chord' as const,
    id: uid(),
    root: c.root,
    quality: c.quality,
    frets: pickVoicing(c.root, c.quality, scale.box),
  }));

const playFrets = (frets: Frets) => audio.playChord(fretsMidi(frets));

const scaleMidis = (tonic: PitchClass, type: SongScale['type']): number[] => {
  const base = 48 + tonic;
  return [...SCALES[type].intervals.map((i) => base + i), base + 12];
};
const SCALE_NOTE_MS = 300;
const CHORD_MS = 1100;
/** How long an item occupies the playback timeline. */
const itemMs = (it: SongItem): number => (it.kind === 'chord' ? CHORD_MS : (SCALES[it.type].intervals.length + 2) * SCALE_NOTE_MS);

export function ChordLab({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'chords' | 'scales'>('chords');
  const [draft, setDraft] = useState<ChordDraft>(() => ({ root: 0, quality: 'maj', frets: bestFrets(0, 'maj', 0) }));
  const [scaleDraft, setScaleDraft] = useState<ScaleChoice>({ tonic: 9, type: 'pentatonicMinor', box: null });
  const [labels, setLabels] = useState<'notes' | 'degrees'>('notes');
  const [harm, setHarm] = useState<Harmonization>('triads');
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
  const targetRow = song.rows.find((r) => r.id === activeRow) ?? song.rows[song.rows.length - 1];

  // ---- what the pickers are bound to: the selected song item (edit) or the explorer draft ----
  const editing = song.rows.flatMap((r) => r.items).find((c) => c.id === selected) ?? null;
  const kind: 'chords' | 'scales' = editing ? (editing.kind === 'chord' ? 'chords' : 'scales') : mode;
  const chord: ChordDraft = editing?.kind === 'chord' ? { root: editing.root, quality: editing.quality, frets: editing.frets } : draft;
  const scale: ScaleChoice = editing?.kind === 'scale' ? { tonic: editing.tonic, type: editing.type, box: editing.box } : scaleDraft;

  const commitChord = (next: ChordDraft) => {
    if (editing?.kind === 'chord') updateSong((s) => updateItem(s, editing.id, (it) => ({ ...(it as SongChord), ...next })));
    else setDraft(next);
  };
  const commitScale = (next: ScaleChoice) => {
    if (editing?.kind === 'scale') updateSong((s) => updateItem(s, editing.id, (it) => ({ ...(it as SongScale), ...next })));
    else setScaleDraft(next);
  };

  const groups = useMemo(() => searchVoicings(chord.root, chord.quality), [chord.root, chord.quality]);
  const curInv = Math.max(0, inversionOf(chord.root, chord.quality, chord.frets));
  const group = groups.find((g) => g.inversion === curInv) ?? groups[0];
  const bassString = chord.frets.findIndex((f) => f >= 0);

  const setRoot = (root: PitchClass) => commitChord({ ...chord, root, frets: bestFrets(root, chord.quality, curInv) });
  const setQuality = (quality: LibraryQuality) => commitChord({ ...chord, quality, frets: bestFrets(chord.root, quality, curInv) });

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlayingId(null);
  };
  const playItem = (it: SongItem) => {
    if (it.kind === 'chord') playFrets(it.frets);
    else scaleMidis(it.tonic, it.type).forEach((m, i) => timers.current.push(window.setTimeout(() => audio.playNote(m), i * SCALE_NOTE_MS)));
  };
  const playItems = (items: SongItem[]) => {
    stop();
    let t = 0;
    for (const it of items) {
      timers.current.push(window.setTimeout(() => { setPlayingId(it.id); playItem(it); }, t));
      t += itemMs(it);
    }
    timers.current.push(window.setTimeout(() => setPlayingId(null), t));
  };

  const songText = [song.name, ...song.rows.map((r) => `${r.label}: ${r.items.map(itemText).join(' | ')}`)].join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(songText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copia el texto:', songText);
    }
  };

  const scalePcsNow = scalePcs(scale.tonic, scale.type);
  const harmChords = scaleChords(scale.tonic, scale.type, harm);
  const heptatonic = scalePcsNow.length === 7;
  const steps = scaleSteps(scale.type);
  const boardMarkers = kind === 'chords' ? markersFor(chord.root, chord.quality, chord.frets) : scaleMarkers(scale.tonic, scale.type, scale.box, labels);
  const boardHighlight = kind === 'scales' && scale.box !== null ? { fretMin: scale.box, fretMax: scale.box + BOX_SPAN } : null;

  return (
    <div className="lessons chordlab">
      <header className="lessons-head">
        <button className="ghost" onClick={onBack}>‹ Menú</button>
        <h1>Acordes y canciones</h1>
        <span />
      </header>

      {editing ? (
        <div className="editing-bar">
          <span>✎ Editando <b>{itemLabel(editing)}</b>: los selectores cambian este elemento.</span>
          <button className="add-btn" onClick={() => setSelected(null)}>✓ Listo</button>
        </div>
      ) : (
        <div className="tabs" role="tablist" aria-label="Qué explorar">
          <button role="tab" aria-selected={mode === 'chords'} className={mode === 'chords' ? 'sel' : ''} onClick={() => setMode('chords')}>Acordes</button>
          <button role="tab" aria-selected={mode === 'scales'} className={mode === 'scales' ? 'sel' : ''} onClick={() => setMode('scales')}>Escalas</button>
        </div>
      )}

      {kind === 'chords' ? (
        <>
          <div className="chips-row" role="group" aria-label="Raíz">
            {NOTE_NAMES.map((nm, pc) => (
              <button key={nm} className={`pill${pc === chord.root ? ' sel' : ''}`} onClick={() => setRoot(pc)}>{nm}</button>
            ))}
          </div>
          <div className="chips-row" role="group" aria-label="Tipo de acorde">
            {LIBRARY_QUALITIES.map((q) => (
              <button key={q} className={`pill wide${q === chord.quality ? ' sel' : ''}`} onClick={() => setQuality(q)}>{CHORD_LIBRARY[q].name}</button>
            ))}
          </div>
        </>
      ) : (
        <ScalePicker value={scale} onChange={commitScale} />
      )}

      <Fretboard fretMax={12} markers={boardMarkers} highlight={boardHighlight} onPlay={(p) => audio.playNote(positionMidi(p))} />

      {kind === 'chords' ? (
        <div className="lesson-card chord-info">
          <div className="chord-title">
            <h2>{libraryChordName(chord.root, chord.quality)}</h2>
            <span className="symbol">{voicingSymbol(chord.root, chord.quality, chord.frets)}</span>
          </div>
          <div className="formula">
            {libraryPcs(chord.root, chord.quality).map((pc, i) => (
              <span key={i} className={`tone ${TONE_KINDS[i] === 'target' ? 'deg7' : TONE_KINDS[i]}`}><b>{noteName(pc)}</b><small>{CHORD_LIBRARY[chord.quality].degrees[i]}</small></span>
            ))}
          </div>
          <p>
            Forma <b>{fretsText(chord.frets)}</b> (× = cuerda muda, 0 = al aire). Bajo: <b>{noteName(stringPc(bassString, chord.frets[bassString]))}</b>
            {curInv <= 0 ? ' → posición fundamental.' : ` → ${curInv}ª inversión: el acorde es el mismo, pero la nota más grave es la ${curInv === 1 ? 'tercera' : curInv === 2 ? 'quinta' : 'séptima'}.`}
          </p>
          <div className="row">
            <button className="ghost" onClick={() => playFrets(chord.frets)}>🔊 Escuchar</button>
            {!editing && (
              <button className="add-btn" onClick={() => updateSong((s) => addItem(s, targetRow.id, { kind: 'chord', id: uid(), ...chord }))}>
                ＋ Añadir a «{targetRow.label}»
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="lesson-card chord-info">
          <div className="chord-title">
            <h2>{noteName(scale.tonic)} {SCALES[scale.type].name.toLowerCase()}</h2>
            <span className="symbol">{scale.box === null ? '0–12' : `${scale.box}–${scale.box + BOX_SPAN}`}</span>
          </div>
          <div className="formula">
            {scalePcsNow.map((pc, i) => (
              <span key={i} className={`tone ${i === 0 ? 'deg1' : 'deg5'}`}><b>{noteName(pc)}</b><small>{SCALES[scale.type].degrees[i]}</small></span>
            ))}
          </div>
          <p className="lead">Pasos entre notas: {steps.join(' – ')} semitonos. Una caja es una ventana de 5 trastes con la escala.</p>
          <h3 className="sub-h">Acordes de esta escala</h3>
          <div className="chips-row left">
            <button className={`pill${harm === 'triads' ? ' sel' : ''}`} onClick={() => setHarm('triads')}>Tríadas</button>
            <button className={`pill${harm === 'sevenths' ? ' sel' : ''}`} onClick={() => setHarm('sevenths')}>Séptimas</button>
          </div>
          <div className="harm">
            {harmChords.map((c, i) => (
              <span key={i} className="harm-chord">
                {heptatonic && <small>{romanNumeral(c.degree, c.quality)}</small>}
                <b>{chordSymbol(c.root, c.quality)}</b>
              </span>
            ))}
            {harmChords.length === 0 && <span className="empty">Esta escala no forma acordes de este tipo con sus propias notas.</span>}
          </div>
          <p className="lead">Son los acordes que se pueden armar usando solo notas de la escala{heptatonic ? ' (apilando terceras sobre cada grado)' : ''}.</p>
          <div className="row wrap">
            <button className="ghost" onClick={() => scaleMidis(scale.tonic, scale.type).forEach((m, i) => window.setTimeout(() => audio.playNote(m), i * SCALE_NOTE_MS))}>🔊 Escuchar</button>
            <button className={`pill${labels === 'notes' ? ' sel' : ''}`} onClick={() => setLabels('notes')}>Notas</button>
            <button className={`pill${labels === 'degrees' ? ' sel' : ''}`} onClick={() => setLabels('degrees')}>Grados</button>
          </div>
          {!editing && (
            <div className="row wrap add-row">
              <button className="add-btn" disabled={harmChords.length === 0} onClick={() => updateSong((s) => addItems(s, targetRow.id, chordItemsOf(scale, harm)))}>
                ＋ Añadir los {harmChords.length} acordes a «{targetRow.label}»
              </button>
              <button className="ghost" onClick={() => updateSong((s) => addItem(s, targetRow.id, { kind: 'scale', id: uid(), ...scale }))}>＋ Solo la escala (notas)</button>
            </div>
          )}
        </div>
      )}

      {kind === 'chords' && (
        <div className="voicing-area">
          <div className="chips-row" role="group" aria-label="Inversión">
            {groups.map((g) => (
              <button key={g.inversion} className={`pill wide${g.inversion === group.inversion ? ' sel' : ''}`} onClick={() => commitChord({ ...chord, frets: g.voicings[0].frets })}>{g.label}</button>
            ))}
          </div>
          <div className="voicings">
            {group.voicings.map((v) => (
              <button key={v.frets.join()} className={`voicing${v.frets.join() === chord.frets.join() ? ' sel' : ''}`} onClick={() => { commitChord({ ...chord, frets: v.frets }); playFrets(v.frets); }}>
                <ChordDiagram root={chord.root} frets={v.frets} />
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
          const sel = row.items.find((c) => c.id === selected);
          return (
            <div key={row.id} className={`song-row${isActive ? ' active' : ''}`} onClick={() => setActiveRow(row.id)}>
              <div className="row-head">
                <input value={row.label} onChange={(e) => updateSong((s) => renameRow(s, row.id, e.target.value))} aria-label="Nombre de la fila" />
                <button className="ghost" disabled={ri === 0} aria-label="Subir fila" onClick={() => updateSong((s) => moveRow(s, row.id, -1))}>↑</button>
                <button className="ghost" disabled={ri === song.rows.length - 1} aria-label="Bajar fila" onClick={() => updateSong((s) => moveRow(s, row.id, 1))}>↓</button>
                <button className="ghost" disabled={!row.items.length} onClick={() => (playingId ? stop() : playItems(row.items))}>{playingId ? '■' : '▶ Fila'}</button>
                <button className="ghost" aria-label="Borrar fila" onClick={() => { if (!row.items.length || confirm('¿Borrar la fila y todo lo que contiene?')) updateSong((s) => removeRow(s, row.id)); }}>🗑</button>
              </div>
              <div className="song-chips">
                {row.items.length === 0 && <span className="empty">Elige un acorde o una escala arriba y pulsa «Añadir».</span>}
                {row.items.map((c) => (
                  <button
                    key={c.id}
                    className={`song-chip${c.kind === 'scale' ? ' scale' : ''}${c.id === selected ? ' sel' : ''}${c.id === playingId ? ' playing' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setSelected(c.id === selected ? null : c.id); setActiveRow(row.id); if (c.id !== selected) { stop(); playItem(c); } }}
                  >
                    {c.kind === 'chord' ? <ChordDiagram root={c.root} frets={c.frets} width={64} /> : <ScaleDiagram tonic={c.tonic} type={c.type} box={c.box} width={c.box === null ? 120 : 96} />}
                    <b>{itemLabel(c)}</b>
                  </button>
                ))}
              </div>
              {sel && (
                <div className="chip-tools" onClick={(e) => e.stopPropagation()}>
                  <button className="ghost" aria-label="Mover a la izquierda" onClick={() => updateSong((s) => moveItem(s, sel.id, -1))}>‹ Izq.</button>
                  <button className="ghost" aria-label="Mover a la derecha" onClick={() => updateSong((s) => moveItem(s, sel.id, 1))}>Der. ›</button>
                  <button className="ghost" disabled={ri === 0} aria-label="Mover a la fila anterior" onClick={() => updateSong((s) => moveItemToRow(s, sel.id, -1))}>⇡ Fila</button>
                  <button className="ghost" disabled={ri === song.rows.length - 1} aria-label="Mover a la fila siguiente" onClick={() => updateSong((s) => moveItemToRow(s, sel.id, 1))}>⇣ Fila</button>
                  {sel.kind === 'scale' && (
                    <button className="ghost" onClick={() => { const chords = chordItemsOf(sel, harm); updateSong((s) => replaceItem(s, sel.id, chords)); setSelected(null); }}>♬ Pasar a acordes</button>
                  )}
                  <button className="ghost" onClick={() => updateSong((s) => duplicateItem(s, sel.id))}>⧉ Duplicar</button>
                  <button className="ghost danger" onClick={() => { updateSong((s) => removeItem(s, sel.id)); setSelected(null); }}>✕ Quitar</button>
                </div>
              )}
            </div>
          );
        })}
        <div className="row songbar">
          <button className="ghost" onClick={() => updateSong(addRow)}>＋ Fila</button>
          <button className="ghost" disabled={!song.rows.some((r) => r.items.length)} onClick={() => (playingId ? stop() : playItems(song.rows.flatMap((r) => r.items)))}>{playingId ? '■ Parar' : '▶ Tocar canción'}</button>
        </div>
        <p className="lead">Toca un elemento para editarlo con los selectores de arriba. Las canciones se guardan en este navegador; usa «Copiar texto» para llevártelas.</p>
      </section>
    </div>
  );
}
