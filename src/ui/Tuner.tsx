import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/webAudio';
import { positionMidi, STANDARD_TUNING, stringOrdinal } from '../fretboard/fretboard';
import { describeDelta, describeShift, makeTuning, SHIFTS, TUNING_PRESETS } from '../fretboard/tunings';
import { midiFreq, noteName } from '../theory';
import { Fretboard, type Marker } from './Fretboard';

const TONE_SECONDS = 4;
const HOLD_SECONDS = 60;
const SEQUENCE_SECONDS = 2.2;

const arrow = (d: number) => (d < 0 ? '↓' : d > 0 ? '↑' : '＝');

export function Tuner({ onBack }: { onBack: () => void }) {
  const [presetId, setPresetId] = useState('standard');
  const [shift, setShift] = useState(-1);
  const [hold, setHold] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  const preset = TUNING_PRESETS.find((p) => p.id === presetId)!;
  const tuning = makeTuning(preset, shift);

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    audio.stopTones();
    setActive(null);
  };
  useEffect(() => stop, []);

  /** Plays the open string `s` of the target tuning, or of the standard tuning when `fromStandard`. */
  const play = (s: number, fromStandard = false, seconds = hold ? HOLD_SECONDS : TONE_SECONDS) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const midi = fromStandard ? STANDARD_TUNING.strings[s].midi : tuning.strings[s].midi;
    audio.playTone(midi, seconds);
    setActive(fromStandard ? null : s);
    timers.current.push(window.setTimeout(() => setActive(null), seconds * 1000));
  };

  const playAll = () => {
    stop();
    for (let i = 0; i < 6; i++) {
      timers.current.push(
        window.setTimeout(() => {
          audio.playTone(tuning.strings[i].midi, SEQUENCE_SECONDS);
          setActive(i);
        }, i * SEQUENCE_SECONDS * 1000),
      );
    }
    timers.current.push(window.setTimeout(() => setActive(null), 6 * SEQUENCE_SECONDS * 1000));
  };

  const markers: Marker[] = tuning.strings.map((s, i) => ({
    pos: { string: i, fret: 0 },
    kind: active === i ? 'found' : 'origin',
    label: s.label,
  }));
  const changed = tuning.strings.filter((s, i) => s.midi !== STANDARD_TUNING.strings[i].midi).length;

  return (
    <div className="lessons tuner">
      <header className="lessons-head">
        <button className="ghost" onClick={() => { stop(); onBack(); }}>‹ Menú</button>
        <h1>Afinador</h1>
        <span />
      </header>
      <p className="lead center">Elige la afinación. Toca una cuerda al aire para oír el tono de referencia y afina tu guitarra hasta que suene igual.</p>

      <div className="chips-row" role="group" aria-label="Afinación">
        {TUNING_PRESETS.map((p) => (
          <button key={p.id} className={`pill wide${p.id === presetId ? ' sel' : ''}`} onClick={() => { stop(); setPresetId(p.id); }}>{p.name}</button>
        ))}
      </div>
      <div className="chips-row" role="group" aria-label="Transposición">
        {SHIFTS.map((n) => (
          <button key={n} className={`pill${n === shift ? ' sel' : ''}`} onClick={() => { stop(); setShift(n); }}>
            {n === 0 ? 'Original' : `${n < 0 ? '↓' : '↑'} ${describeShift(n)}`.replace(' abajo', '').replace(' arriba', '')}
          </button>
        ))}
      </div>

      <Fretboard
        fretMax={12}
        tuning={tuning}
        markers={markers}
        showNotes
        onPlay={(p) => (p.fret === 0 ? play(p.string) : audio.playNote(positionMidi(p, tuning)))}
      />
      <p className="lead center">Cuerda al aire (traste 0) = tono sostenido de referencia. Otros trastes = nota pulsada.</p>

      <div className="lesson-card tuner-card">
        <div className="chord-title">
          <h2>{tuning.name}</h2>
          <span className="symbol">{tuning.strings.map((s) => s.label).reverse().join(' ')}</span>
        </div>
        <p className="lead">
          {changed === 0
            ? 'Es la afinación normal de tu guitarra: no hay que cambiar nada.'
            : `Partiendo de la afinación estándar (E A D G B E), ${changed === 6 ? 'cambia las 6 cuerdas' : `cambia ${changed} ${changed === 1 ? 'cuerda' : 'cuerdas'}`}.`}
          {' '}Afina siempre de una en una, de la 6ª a la 1ª.
        </p>

        <div className="tuner-rows">
          {tuning.strings.map((s, i) => {
            const delta = s.midi - STANDARD_TUNING.strings[i].midi;
            const std = noteName(STANDARD_TUNING.strings[i].midi);
            return (
              <div key={i} className={`tuner-row${active === i ? ' on' : ''}`}>
                <div className="t-string"><b>{stringOrdinal(i)}</b><span>cuerda</span></div>
                <div className="t-note"><b>{s.label}</b><small>{midiFreq(s.midi).toFixed(1)} Hz</small></div>
                <div className={`t-delta${delta < 0 ? ' down' : delta > 0 ? ' up' : ''}`}>
                  <b>{arrow(delta)} {describeDelta(delta)}</b>
                  <small>{delta === 0 ? 'ya está afinada' : `${std} → ${s.label} · ${delta < 0 ? 'afloja' : 'tensa'} la clavija`}</small>
                </div>
                <div className="t-btns">
                  <button className="add-btn" onClick={() => play(i)}>▶ Objetivo</button>
                  {delta !== 0 && <button className="ghost" onClick={() => play(i, true)}>▶ Ahora ({std})</button>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="row wrap add-row">
          <button className="add-btn" onClick={playAll}>▶ Tocar las 6 cuerdas</button>
          <button className="ghost" onClick={stop}>■ Parar</button>
          <button className={`pill${hold ? ' sel' : ''}`} onClick={() => setHold(!hold)} aria-pressed={hold}>Mantener el sonido</button>
        </div>
        {shift > 0 && <p className="lead warn">Subir de tono tensa las cuerdas: hazlo despacio, porque pueden romperse.</p>}
        <p className="lead">Referencia: A4 = 440 Hz. Tip: baja siempre desde arriba hacia la nota; si te pasas, vuelve a subir para dejar la cuerda tensa y estable.</p>
      </div>
    </div>
  );
}
