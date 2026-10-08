import { useMemo, useState } from 'react';
import { audio } from '../audio/webAudio';
import { intervalLesson } from '../engine/hints';
import {
  describeShape,
  positionMidi,
  positionNote,
  positionPc,
  positionsOfPc,
  STANDARD_TUNING,
  stringOrdinal,
  type Position,
} from '../fretboard/fretboard';
import { CHORD_FORMULAS, chordName, chordPcs, INTERVALS, intervalName, noteName, NOTE_NAMES, type ChordQuality } from '../theory';
import { findVoicings, targetsFrom } from '../challenges/util';
import { Practice, cap, plural } from './lessonKit';
import { ScalesLesson } from './ScalesLesson';
import { GeometryLesson } from './GeometryLesson';
import { Fretboard, type Marker } from './Fretboard';

type Tab = 'notes' | 'intervals' | 'chords' | 'scales' | 'geometry';
const FULL = { fretMin: 0, fretMax: 12 };
function NotesLesson() {
  const [sel, setSel] = useState<Position>({ string: 1, fret: 3 });
  const pc = positionPc(sel);
  const note = noteName(pc);
  const open = noteName(STANDARD_TUNING.strings[sel.string].midi);
  const all = positionsOfPc(pc, FULL);
  const markers: Marker[] = [
    ...all.filter((p) => p.string !== sel.string || p.fret !== sel.fret).map((p) => ({ pos: p, kind: 'found' as const, label: note })),
    { pos: sel, kind: 'origin', label: note },
  ];
  return (
    <>
      <Fretboard
        fretMax={12}
        markers={markers}
        showNotes
        onPlay={(p) => { audio.playNote(positionMidi(p)); setSel(p); }}
      />
      <div className="lesson-card">
        <h2>Cada traste es un semitono</h2>
        <p className="lead">Toca cualquier posición. Verás dónde más suena esa misma nota.</p>
        <p>
          <b>{note}</b>: {sel.fret === 0
            ? `es la cuerda ${stringOrdinal(sel.string)} al aire.`
            : `la cuerda ${stringOrdinal(sel.string)} suena ${open} al aire; ${open} + ${plural(sel.fret)} = ${note}.`}{' '}
          Aparece en {all.length} posiciones entre los trastes 0 y 12.
        </p>
        <ul>
          <li>Hay 12 notas: <b>{NOTE_NAMES.join(' ')}</b>, y vuelven a empezar.</li>
          <li>Entre <b>E–F</b> y <b>B–C</b> hay 1 semitono (no hay sostenido). Entre las demás naturales hay 2.</li>
          <li>El <b>traste 12</b> repite la cuerda al aire una octava más aguda.</li>
          <li>Las cuerdas vecinas están a 5 semitonos (4 entre G y B).</li>
        </ul>
        <Practice stage="notes" label="Practicar notas" />
      </div>
    </>
  );
}

function IntervalsLesson() {
  const [n, setN] = useState(7);
  const [origin, setOrigin] = useState<Position>({ string: 1, fret: 3 });
  const targets = useMemo(() => targetsFrom(origin, n, FULL), [origin, n]);
  const from = positionNote(origin);
  const to = noteName(positionPc(origin) + n);
  const markers: Marker[] = [];
  if (origin.fret + n <= 12) {
    for (let i = 1; i < n; i++) markers.push({ pos: { string: origin.string, fret: origin.fret + i }, kind: 'step', label: String(i) });
  }
  for (const t of targets) markers.push({ pos: t, kind: 'target', label: noteName(positionPc(t)) });
  markers.push({ pos: origin, kind: 'origin', label: from });
  const nearest = [...targets].sort((a, b) => Math.abs(a.string - origin.string) + Math.abs(a.fret - origin.fret) - (Math.abs(b.string - origin.string) + Math.abs(b.fret - origin.fret)))[0];

  return (
    <>
      <div className="chips-row" role="group" aria-label="Intervalo">
        {INTERVALS.filter((i) => i.semitones > 0).map((i) => (
          <button key={i.semitones} className={`pill${i.semitones === n ? ' sel' : ''}`} onClick={() => { setN(i.semitones); audio.playInterval(positionMidi(origin), positionMidi(origin) + i.semitones, 'melodic'); }}>
            {cap(i.name)}
          </button>
        ))}
      </div>
      <Fretboard fretMax={12} markers={markers} onPlay={(p) => { audio.playNote(positionMidi(p)); setOrigin(p); }} />
      <div className="lesson-card">
        <p className="lead">Toca el mástil para cambiar la nota de origen (ámbar).</p>
        <h2>{cap(intervalName(n))}: {plural(n)}</h2>
        <p className="big-line">{from} → {to}</p>
        <p>{intervalLesson(n)}</p>
        {nearest ? (
          <p>En el mástil, desde {from} hasta {to}: <b>{describeShape(origin, nearest)}</b>.{origin.fret + n <= 12 ? ' Los puntos numerados cuentan los semitonos en la misma cuerda.' : ''}</p>
        ) : (
          <p>Desde esta posición el destino no cabe en el mástil. Elige otra nota de origen.</p>
        )}
        <div className="row">
          <button className="ghost" onClick={() => audio.playInterval(positionMidi(origin), positionMidi(origin) + n, 'melodic')}>🔊 Escuchar</button>
          <button className="ghost" onClick={() => audio.playInterval(positionMidi(origin), positionMidi(origin) + n, 'harmonic')}>🔊 Juntas</button>
        </div>
        <Practice stage="intervals" label="Practicar intervalos" />
      </div>
    </>
  );
}

function ChordsLesson() {
  const [root, setRoot] = useState(0);
  const [quality, setQuality] = useState<ChordQuality>('maj');
  const [shape, setShape] = useState(false);
  const f = CHORD_FORMULAS[quality];
  const pcs = chordPcs(root, quality);
  const voicing = useMemo(() => {
    const vs = findVoicings(root, quality, FULL);
    vs.sort((a, b) => Math.max(...a.map((p) => p.fret)) - Math.max(...b.map((p) => p.fret)) || a.reduce((s, p) => s + p.fret, 0) - b.reduce((s, p) => s + p.fret, 0));
    return vs[0] ?? [];
  }, [root, quality]);
  const kinds = ['deg1', 'deg3', 'deg5'] as const;
  const markers: Marker[] = [];
  if (shape) {
    for (const p of voicing) markers.push({ pos: p, kind: kinds[pcs.indexOf(positionPc(p))], label: positionNote(p) });
  } else {
    pcs.forEach((pc, i) => positionsOfPc(pc, FULL).forEach((p) => markers.push({ pos: p, kind: kinds[i], label: noteName(pc) })));
  }
  const play = () => {
    if (shape && voicing.length) audio.playChord(voicing.map((p) => positionMidi(p)));
    else audio.playChord(f.intervals.map((i) => 48 + root + i));
  };

  return (
    <>
      <div className="chips-row" role="group" aria-label="Raíz">
        {NOTE_NAMES.map((nm, pc) => (
          <button key={nm} className={`pill${pc === root ? ' sel' : ''}`} onClick={() => setRoot(pc)}>{nm}</button>
        ))}
      </div>
      <div className="chips-row">
        {(Object.keys(CHORD_FORMULAS) as ChordQuality[]).map((q) => (
          <button key={q} className={`pill wide${q === quality ? ' sel' : ''}`} onClick={() => setQuality(q)}>{cap(CHORD_FORMULAS[q].name)}</button>
        ))}
        <button className={`pill wide${shape ? ' sel' : ''}`} onClick={() => setShape(!shape)}>Ver una forma tocable</button>
      </div>
      <Fretboard fretMax={12} markers={markers} onPlay={(p) => audio.playNote(positionMidi(p))} />
      <div className="lesson-card">
        <h2>{chordName(root, quality)}</h2>
        <div className="formula">
          {pcs.map((pc, i) => (
            <span key={i} className="formula-part">
              {i > 0 && <i className="step">+{f.intervals[i] - f.intervals[i - 1]}</i>}
              <span className={`tone ${kinds[i]}`}><b>{noteName(pc)}</b><small>{f.degrees[i]}</small></span>
            </span>
          ))}
        </div>
        <p>Una tríada se arma <b>apilando terceras</b>: raíz + tercera + quinta ({f.degrees.join(' · ')}).</p>
        <ul>
          <li>{noteName(pcs[0])} → {noteName(pcs[1])} = <b>{intervalName(f.intervals[1])}</b> ({plural(f.intervals[1])})</li>
          <li>{noteName(pcs[0])} → {noteName(pcs[2])} = <b>quinta justa</b> ({plural(7)})</li>
          <li>{quality === 'maj' ? 'Mayor' : 'Menor'} vs {quality === 'maj' ? 'menor' : 'mayor'}: solo cambia la tercera ({quality === 'maj' ? '4 vs 3' : '3 vs 4'} semitonos).</li>
        </ul>
        <div className="legend"><span className="deg1">raíz</span><span className="deg3">tercera</span><span className="deg5">quinta</span></div>
        <div className="row"><button className="ghost" onClick={play}>🔊 Escuchar</button></div>
        <Practice stage="chords" label="Practicar acordes" />
      </div>
    </>
  );
}

export function Lessons({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('notes');
  return (
    <div className="lessons">
      <header className="lessons-head">
        <button className="ghost" onClick={onBack}>‹ Menú</button>
        <h1>Clases</h1>
        <span />
      </header>
      <div className="tabs" role="tablist">
        {([['notes', 'Notas'], ['intervals', 'Intervalos'], ['chords', 'Acordes'], ['scales', 'Escalas'], ['geometry', 'Geometría']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'sel' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'notes' && <NotesLesson />}
      {tab === 'intervals' && <IntervalsLesson />}
      {tab === 'chords' && <ChordsLesson />}
      {tab === 'scales' && <ScalesLesson />}
      {tab === 'geometry' && <GeometryLesson />}
    </div>
  );
}
