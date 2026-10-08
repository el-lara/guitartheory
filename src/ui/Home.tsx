import { useState } from 'react';
import { Fretboard } from './Fretboard';
import { game } from './useGame';
import { STAGES, MAX_LEVEL, stageById } from '../progression/stages';
import { emptyProgress } from '../progression/progress';
import { emptySrs } from '../srs/srs';
import type { Mode, Snapshot } from '../game/Game';

const DEMO = [
  { pos: { string: 1, fret: 3 }, kind: 'found' as const, label: 'C' },
  { pos: { string: 2, fret: 2 }, kind: 'found' as const, label: 'E' },
  { pos: { string: 4, fret: 1 }, kind: 'found' as const, label: 'C' },
  { pos: { string: 3, fret: 0 }, kind: 'found' as const, label: 'G' },
];

export function Home({ s }: { s: Snapshot }) {
  const [mode, setMode] = useState<Mode>('mix');
  const [minutes, setMinutes] = useState(5);

  return (
    <div className="home">
      <h1 className="logo">Fret<span>Quest</span></h1>
      <p className="tag">Aprende el mástil jugando.</p>
      <Fretboard fretMax={8} markers={DEMO} onPlay={() => {}} disabled />

      <div className="modes">
        <button className={`mode mix${mode === 'mix' ? ' sel' : ''}`} onClick={() => setMode('mix')}>
          <b>Entrenamiento mixto</b>
          <span>Notas, intervalos y acordes según tu nivel</span>
        </button>
        {STAGES.map((st) => {
          const unlocked = game.isUnlocked(st.id);
          const lvl = s.levels[st.id];
          const req = st.requires ? stageById(st.requires.stage) : null;
          return (
            <button key={st.id} disabled={!unlocked} className={`mode${mode === st.id ? ' sel' : ''}`} onClick={() => setMode(st.id)}>
              <b>{st.name}</b>
              <span>{unlocked ? st.tagline : `Llega al nivel ${st.requires!.level} en «${req!.name}»`}</span>
              <em className="pips" aria-label={`Nivel ${lvl}`}>
                {unlocked ? Array.from({ length: MAX_LEVEL }, (_, i) => <i key={i} className={i < lvl ? 'on' : ''} />) : '🔒'}
              </em>
            </button>
          );
        })}
      </div>

      <div className="durations" role="group" aria-label="Duración">
        {[5, 10, 15].map((m) => (
          <button key={m} className={m === minutes ? 'sel' : ''} onClick={() => setMinutes(m)}>{m} min</button>
        ))}
      </div>
      <button className="big play-btn" onClick={() => game.start({ mode, minutes })}>Jugar</button>
      {s.bestScore > 0 && <p className="best">Récord: {s.bestScore}</p>}
      <button
        className="ghost reset"
        onClick={() => { if (confirm('¿Borrar todo el progreso?')) game.resetProgress(emptyProgress(), emptySrs()); }}
      >
        Reiniciar progreso
      </button>
    </div>
  );
}
