import { useRef, useState } from 'react';
import { audio } from '../audio/webAudio';
import { positionMidi, positionPc, regionPositions } from '../fretboard/fretboard';
import { intervalName, noteName, NOTE_NAMES, SCALE_TYPES, SCALES, scalePcs, scaleSteps, type ScaleType } from '../theory';
import { Fretboard, type Marker } from './Fretboard';

const FULL = { fretMin: 0, fretMax: 12 };
const WINDOW = 4; // a "box" spans 5 frets: start..start+4

const stepName = (n: number) => (n === 1 ? 'S' : n === 2 ? 'T' : n === 3 ? 'T+S' : String(n));

const GEOMETRY: Record<ScaleType, string> = {
  major: 'El patrón T T S T T T S es siempre el mismo: cambia la nota donde empiezas y toda la forma se desplaza.',
  naturalMinor: 'Tiene las mismas notas que la mayor que empieza 3 semitonos más arriba (su relativa). Solo cambia dónde "aterrizas".',
  pentatonicMajor: 'Cinco notas: la mayor sin el 4º ni el 7º, los grados que chocan con el acorde. Es la misma caja que la pentatónica menor 3 semitonos más grave.',
  pentatonicMinor: 'Cinco notas: la menor sin el 2º ni el 6º. Es la "caja" más usada: dos notas por cuerda y se desliza por el mástil.',
  blues: 'Pentatónica menor más una nota de paso: la ♭5. Esa nota "sucia" da el color blues.',
};

export function ScalesLesson() {
  const [tonic, setTonic] = useState(0);
  const [type, setType] = useState<ScaleType>('pentatonicMinor');
  const [labels, setLabels] = useState<'notes' | 'degrees'>('notes');
  const [box, setBox] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  const info = SCALES[type];
  const pcs = scalePcs(tonic, type);
  const steps = scaleSteps(type);
  const degreeOf = (pc: number) => info.degrees[pcs.indexOf(pc)];

  const markers: Marker[] = [];
  for (const pos of regionPositions(FULL)) {
    const pc = positionPc(pos);
    if (!pcs.includes(pc)) continue;
    const inBox = box === null || (pos.fret >= box && pos.fret <= box + WINDOW);
    markers.push({
      pos,
      kind: !inBox ? 'dim' : pc === tonic ? 'deg1' : 'deg5',
      label: labels === 'notes' ? noteName(pc) : degreeOf(pc),
    });
  }

  const rootFretOn6 = (tonic - 4 + 12) % 12; // fret of the tonic on the low E string
  const boxStart = Math.min(rootFretOn6, 8);

  const play = () => {
    timers.current.forEach(clearTimeout);
    const base = 48 + tonic;
    const midis = [...info.intervals.map((i) => base + i), base + 12];
    timers.current = midis.map((m, i) => window.setTimeout(() => audio.playNote(m), i * 320));
  };

  return (
    <>
      <div className="chips-row" role="group" aria-label="Tónica">
        {NOTE_NAMES.map((nm, pc) => (
          <button key={nm} className={`pill${pc === tonic ? ' sel' : ''}`} onClick={() => setTonic(pc)}>{nm}</button>
        ))}
      </div>
      <div className="chips-row" role="group" aria-label="Escala">
        {SCALE_TYPES.map((t) => (
          <button key={t} className={`pill wide${t === type ? ' sel' : ''}`} onClick={() => setType(t)}>{SCALES[t].name}</button>
        ))}
      </div>
      <div className="chips-row">
        <button className={`pill${labels === 'notes' ? ' sel' : ''}`} onClick={() => setLabels('notes')}>Notas</button>
        <button className={`pill${labels === 'degrees' ? ' sel' : ''}`} onClick={() => setLabels('degrees')}>Grados</button>
        <span className="sep" />
        <button className="pill" disabled={box === null || box <= 0} onClick={() => setBox((b) => Math.max(0, (b ?? 0) - 1))}>‹</button>
        <button className={`pill wide${box !== null ? ' sel' : ''}`} onClick={() => setBox(box === null ? boxStart : null)}>
          {box === null ? 'Ver una caja' : `Caja: trastes ${box}–${box + WINDOW}`}
        </button>
        <button className="pill" disabled={box === null || box >= 8} onClick={() => setBox((b) => Math.min(8, (b ?? 0) + 1))}>›</button>
      </div>
      <Fretboard
        fretMax={12}
        markers={markers}
        highlight={box === null ? null : { fretMin: box, fretMax: box + WINDOW }}
        onPlay={(p) => audio.playNote(positionMidi(p))}
      />
      <div className="lesson-card">
        <h2>{noteName(tonic)} {info.name.toLowerCase()}</h2>
        <div className="formula">
          {pcs.map((pc, i) => (
            <span key={i} className="formula-part">
              {i > 0 && <i className="step">+{info.intervals[i] - info.intervals[i - 1]}</i>}
              <span className={`tone ${i === 0 ? 'deg1' : 'deg5'}`}><b>{noteName(pc)}</b><small>{info.degrees[i]}</small></span>
            </span>
          ))}
          <span className="formula-part"><i className="step">+{steps[steps.length - 1]}</i><span className="tone deg1"><b>{noteName(tonic)}</b><small>8ª</small></span></span>
        </div>
        <p className="big-line">{steps.map(stepName).join(' ')}</p>
        <p className="lead">T = tono (2 semitonos) · S = semitono (1). Distancias: {steps.join(' – ')}.</p>
        <p>{GEOMETRY[type]}</p>
        <ul>
          <li>Cada nota es un intervalo desde la tónica: {pcs.slice(1).map((pc, i) => `${noteName(pc)} = ${intervalName(info.intervals[i + 1])}`).slice(0, 3).join(', ')}…</li>
          <li>La forma es <b>móvil</b>: cambia la tónica de arriba y la misma figura se desplaza por el mástil.</li>
          <li>Una <b>caja</b> es una ventana de 5 trastes con la escala: así se toca sin pensar nota a nota.</li>
        </ul>
        <div className="row"><button className="ghost" onClick={play}>🔊 Escuchar escala</button></div>
      </div>
    </>
  );
}
