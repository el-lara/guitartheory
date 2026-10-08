import { Home } from './Home';
import { Play } from './Play';
import { Summary } from './Summary';
import { useGame } from './useGame';

export function App() {
  const s = useGame();
  return (
    <main className="app">
      {s.phase === 'idle' && <Home s={s} />}
      {(s.phase === 'playing' || s.phase === 'discovery') && <Play s={s} />}
      {s.phase === 'summary' && s.summary && <Summary s={s} />}
    </main>
  );
}
