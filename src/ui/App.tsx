import { useEffect, useState } from 'react';
import { Home } from './Home';
import { ChordLab } from './ChordLab';
import { Lessons } from './Lessons';
import { Play } from './Play';
import { Summary } from './Summary';
import { Tuner } from './Tuner';
import { useGame } from './useGame';

export function App() {
  const s = useGame();
  const [view, setView] = useState<'home' | 'lessons' | 'chords' | 'tuner'>('home');
  useEffect(() => {
    if (s.phase !== 'idle') setView('home'); // practising from a lesson leaves the lessons view
  }, [s.phase]);
  return (
    <main className="app">
      {s.phase === 'idle' && view === 'home' && <Home s={s} onLessons={() => setView('lessons')} onChords={() => setView('chords')} onTuner={() => setView('tuner')} />}
      {s.phase === 'idle' && view === 'lessons' && <Lessons onBack={() => setView('home')} />}
      {s.phase === 'idle' && view === 'chords' && <ChordLab onBack={() => setView('home')} />}
      {s.phase === 'idle' && view === 'tuner' && <Tuner onBack={() => setView('home')} />}
      {(s.phase === 'playing' || s.phase === 'discovery') && <Play s={s} />}
      {s.phase === 'summary' && s.summary && <Summary s={s} />}
    </main>
  );
}
