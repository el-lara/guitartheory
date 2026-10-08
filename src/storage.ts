import { emptyProgress } from './progression/progress';
import { emptySrs } from './srs/srs';
import type { Persisted } from './game/Game';

const KEY = 'fretquest:v1';

export const emptyPersisted = (): Persisted => ({ srs: emptySrs(), progress: emptyProgress(), bestScore: 0 });

export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyPersisted();
    const p = JSON.parse(raw) as Persisted;
    const base = emptyPersisted();
    return {
      srs: { tick: p.srs?.tick ?? 0, records: p.srs?.records ?? {} },
      progress: { ...base.progress, ...p.progress },
      bestScore: p.bestScore ?? 0,
    };
  } catch {
    return emptyPersisted();
  }
}

export function savePersisted(p: Persisted): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress simply isn't kept */
  }
}
