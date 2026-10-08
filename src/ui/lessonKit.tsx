import type { StageId } from '../progression/stages';
import { game } from './useGame';

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const plural = (n: number) => `${n} ${n === 1 ? 'semitono' : 'semitonos'}`;

export function Practice({ stage, label }: { stage: StageId; label: string }) {
  return (
    <button className="big small" onClick={() => game.start({ mode: stage, minutes: 5 })}>
      {label}
    </button>
  );
}
