import { useRef, useState } from 'react';
import { audio } from '../audio/webAudio';
import { fifthsPc, intervalName, keySignature, noteName, NOTE_NAMES } from '../theory';

const C = 200; // viewBox centre
const RING = 118;

/** Point at `index` (0..11) clockwise from the top, at radius r. */
const pt = (index: number, r: number): [number, number] => {
  const a = (index * 30 * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
};

interface Shape {
  id: string;
  label: string;
  offsets: number[];
  blurb: string;
}

const SHAPES: Shape[] = [
  { id: 'fifth', label: 'Quinta justa', offsets: [0, 7], blurb: 'Dos puntos separados 7 pasos. Mismo ángulo siempre, desde cualquier nota.' },
  { id: 'tritone', label: 'Tritono', offsets: [0, 6], blurb: 'El lado opuesto del círculo: divide la octava exactamente por la mitad.' },
  { id: 'maj', label: 'Tríada mayor', offsets: [0, 4, 7], blurb: 'Un triángulo con arcos 4 · 3 · 5. Todas las tríadas mayores son este mismo triángulo girado.' },
  { id: 'min', label: 'Tríada menor', offsets: [0, 3, 7], blurb: 'Arcos 3 · 4 · 5: el triángulo mayor "dado la vuelta" (la tercera cambia de sitio).' },
  { id: 'aug', label: 'Triángulo equilátero', offsets: [0, 4, 8], blurb: 'Arcos 4 · 4 · 4 (acorde aumentado): tan simétrico que solo hay 4 triángulos distintos.' },
  { id: 'dim', label: 'Cuadrado', offsets: [0, 3, 6, 9], blurb: 'Arcos 3 · 3 · 3 · 3 (séptima disminuida): un cuadrado perfecto; solo hay 3 distintos.' },
  { id: 'major', label: 'Escala mayor', offsets: [0, 2, 4, 5, 7, 9, 11], blurb: 'Arcos 2 2 1 2 2 2 1: siete puntos con dos "huecos cortos" (los semitonos).' },
  { id: 'pentmin', label: 'Pentatónica menor', offsets: [0, 3, 5, 7, 10], blurb: 'Arcos 3 2 2 3 2: cinco puntos casi equilibrados, de ahí que suene tan estable.' },
];

const FIFTHS_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F#/Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const FIFTHS_MINOR = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];
const ROMAN: Record<number, string> = { [-1]: 'IV', 0: 'I', 1: 'V', 2: 'II', 3: 'VI', 4: 'III', 5: 'VII' };

function ClockView() {
  const [root, setRoot] = useState(0);
  const [shapeId, setShapeId] = useState('maj');
  const rot = useRef(0);
  const shape = SHAPES.find((s) => s.id === shapeId)!;

  // accumulate rotation along the shortest path so shapes turn smoothly
  const target = root * 30;
  const delta = ((target - (rot.current % 360) + 540) % 360) - 180;
  rot.current += delta;

  const verts = shape.offsets.map((o) => (root + o) % 12).sort((a, b) => a - b);
  const arcs = verts.map((v, i) => ((verts[(i + 1) % verts.length] - v + 12) % 12) || 12);
  const polyPoints = shape.offsets.map((o) => pt(o, RING).join(',')).join(' ');
  const active = new Set(verts);

  const play = () => {
    const base = 60 + root;
    const sorted = [...shape.offsets].sort((a, b) => a - b);
    if (sorted.length <= 4) audio.playChord(sorted.map((o) => base + o));
    else sorted.forEach((o, i) => window.setTimeout(() => audio.playNote(base + o), i * 300));
  };

  return (
    <>
      <div className="chips-row" role="group" aria-label="Raíz">
        {NOTE_NAMES.map((nm, pc) => (
          <button key={nm} className={`pill${pc === root ? ' sel' : ''}`} onClick={() => setRoot(pc)}>{nm}</button>
        ))}
      </div>
      <div className="chips-row" role="group" aria-label="Forma">
        {SHAPES.map((s) => (
          <button key={s.id} className={`pill wide${s.id === shapeId ? ' sel' : ''}`} onClick={() => setShapeId(s.id)}>{s.label}</button>
        ))}
      </div>
      <svg className="geo" viewBox="0 0 400 400" role="img" aria-label="Reloj de las 12 notas">
        <circle cx={C} cy={C} r={RING} className="geo-ring" />
        <g style={{ transformOrigin: `${C}px ${C}px`, transform: `rotate(${rot.current}deg)`, transition: 'transform .5s ease' }}>
          <polygon points={polyPoints} className="geo-shape" strokeLinejoin="round" />
        </g>
        {arcs.map((a, i) => {
          const mid = verts[i] + a / 2;
          const [x, y] = pt(mid, RING + 38);
          return <text key={i} x={x} y={y + 5} textAnchor="middle" className="geo-arc">{a}</text>;
        })}
        {NOTE_NAMES.map((nm, pc) => {
          const [x, y] = pt(pc, RING);
          const on = active.has(pc);
          return (
            <g key={nm} className="geo-pt" onPointerDown={() => audio.playNote(60 + pc)}>
              <circle cx={x} cy={y} r={on ? 19 : 14} className={on ? (pc === root ? 'on root' : 'on') : 'off'} />
              <text x={x} y={y + 4.5} textAnchor="middle" className={on ? 'on' : 'off'}>{nm}</text>
            </g>
          );
        })}
        <text x={C} y={C - 4} textAnchor="middle" className="geo-center">{shape.label}</text>
        <text x={C} y={C + 18} textAnchor="middle" className="geo-center-sub">{arcs.join(' · ')}</text>
      </svg>
      <div className="lesson-card">
        <h2>{noteName(root)} · {shape.label}</h2>
        <p>{shape.blurb}</p>
        <ul>
          <li>Los números de fuera son los <b>pasos</b> (semitonos) entre puntos vecinos. Suman siempre 12.</li>
          <li>Cambia la raíz y la figura <b>gira sin deformarse</b>: por eso en la guitarra una forma se puede deslizar por el mástil.</li>
          {shape.offsets.slice(1).map((o) => (
            <li key={o}>{noteName(root)} → {noteName(root + o)} = {intervalName(o)}</li>
          ))}
        </ul>
        <div className="row"><button className="ghost" onClick={play}>🔊 Escuchar</button></div>
      </div>
    </>
  );
}

function FifthsView() {
  const [k, setK] = useState(0);
  const sig = keySignature(k);
  const inKey = new Set(Array.from({ length: 7 }, (_, i) => ((k - 1 + i) % 12 + 12) % 12));
  const R = 140;

  // band over the 7 consecutive places that make the major scale (IV … VII)
  const a0 = (k - 1 - 0.5) * 30;
  const a1 = (k + 5 + 0.5) * 30;
  const p0 = pt((a0 / 30), R);
  const p1 = pt((a1 / 30), R);

  return (
    <>
      <svg className="geo" viewBox="0 0 400 400" role="img" aria-label="Círculo de quintas">
        <path d={`M ${p0[0]} ${p0[1]} A ${R} ${R} 0 1 1 ${p1[0]} ${p1[1]}`} className="geo-band" />
        {FIFTHS_MAJOR.map((nm, i) => {
          const [x, y] = pt(i, R);
          const [mx, my] = pt(i, 92);
          const rel = (((i - k) % 12) + 12) % 12;
          const offset = rel === 11 ? -1 : rel <= 5 ? rel : null;
          const on = inKey.has(i);
          const [rx, ry] = pt(i, 182);
          return (
            <g key={nm} className="geo-pt" onPointerDown={() => { setK(i); audio.playNote(60 + fifthsPc(i)); }}>
              <circle cx={x} cy={y} r={20} className={i === k ? 'on root' : on ? 'on' : 'off'} />
              <text x={x} y={y + 4.5} textAnchor="middle" className={on ? 'on' : 'off'}>{nm}</text>
              <circle cx={mx} cy={my} r={14} className={on ? 'minor on' : 'minor off'} />
              <text x={mx} y={my + 4} textAnchor="middle" className="geo-minor">{FIFTHS_MINOR[i]}</text>
              {offset !== null && <text x={rx} y={ry + 4} textAnchor="middle" className="geo-roman">{ROMAN[offset]}</text>}
            </g>
          );
        })}
        <text x={C} y={C - 2} textAnchor="middle" className="geo-center">{FIFTHS_MAJOR[k].split('/')[0]} mayor</text>
        <text x={C} y={C + 18} textAnchor="middle" className="geo-center-sub">{sig.count === 0 ? 'sin alteraciones' : `${sig.count} ${sig.kind === 'sharps' ? '♯' : '♭'}`}</text>
      </svg>
      <div className="lesson-card">
        <h2>{FIFTHS_MAJOR[k].split('/')[0]} mayor · {FIFTHS_MINOR[k]} menor</h2>
        <p className="lead">Toca una nota del círculo para elegir la tonalidad.</p>
        <ul>
          <li>Cada paso a la derecha sube una <b>quinta justa</b> (+7 semitonos). Por eso se llama círculo de quintas.</li>
          <li>Una escala mayor son <b>7 casillas seguidas</b> (la banda): IV · I · V · II · VI · III · VII.</li>
          <li>Tonalidades vecinas comparten 6 de 7 notas: cambian solo en una alteración.</li>
          <li>Anillo interior: la <b>relativa menor</b> (mismas notas, otra tónica: {FIFTHS_MAJOR[k].split('/')[0]} → {FIFTHS_MINOR[k]}).</li>
          <li>{sig.count === 0 ? 'Sin sostenidos ni bemoles: solo notas naturales.' : `Armadura: ${sig.count} ${sig.kind === 'sharps' ? 'sostenido(s)' : 'bemol(es)'} → ${sig.notes.join(' ')}.`}</li>
        </ul>
      </div>
    </>
  );
}

export function GeometryLesson() {
  const [view, setView] = useState<'clock' | 'fifths'>('clock');
  return (
    <>
      <div className="chips-row">
        <button className={`pill wide${view === 'clock' ? ' sel' : ''}`} onClick={() => setView('clock')}>Reloj de las 12 notas</button>
        <button className={`pill wide${view === 'fifths' ? ' sel' : ''}`} onClick={() => setView('fifths')}>Círculo de quintas</button>
      </div>
      {view === 'clock' ? <ClockView /> : <FifthsView />}
    </>
  );
}
