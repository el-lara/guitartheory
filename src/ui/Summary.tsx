import { game } from './useGame';
import type { Snapshot } from '../game/Game';

export function Summary({ s }: { s: Snapshot }) {
  const sum = s.summary!;
  return (
    <div className="summary">
      <h1>Sesión terminada</h1>
      {sum.reason === 'lives' && <p className="sub">Te quedaste sin vidas.</p>}
      <div className="stats">
        <div><b>{sum.total}</b><span>desafíos</span></div>
        <div><b>{sum.perfect}</b><span>correctos</span></div>
        <div><b>{sum.bestStreak}</b><span>racha máxima</span></div>
        <div><b>{sum.score}</b><span>puntos{sum.newBest ? ' · ¡récord!' : ''}</span></div>
      </div>
      <p className="tip">{sum.tip}</p>
      <button className="big" onClick={() => game.start(s.config)}>Jugar otra vez</button>
      <button className="ghost" onClick={() => game.home()}>Inicio</button>
    </div>
  );
}
