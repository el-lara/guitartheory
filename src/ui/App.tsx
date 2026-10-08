import { useEffect, useState } from 'react';
import { Home } from './Home';
import { Lessons } from './Lessons';
import { Play } from './Play';
import { Summary } from './Summary';
import { useGame } from './useGame';

export function App() {
  const s = useGame();
  const [lessons, setLessons] = useState(false);
  useEffect(() => {
    if (s.phase !== 'idle') setLessons(false); // practising from a lesson leaves the lessons view
  }, [s.phase]);
  return (
    <main className="app">
      {s.phase === 'idle' && !lessons && <Home s={s} onLessons={() => setLessons(true)} />}
      {s.phase === 'idle' && lessons && <Lessons onBack={() => setLessons(false)} />}
      {(s.phase === 'playing' || s.phase === 'discovery') && <Play s={s} />}
      {s.phase === 'summary' && s.summary && <Summary s={s} />}
    </main>
  );
}
