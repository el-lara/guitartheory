import { stringPc, type Frets } from '../chordlab/voicings';
import type { PitchClass } from '../theory';
import { fingeringOf } from '../chordlab/voicings';

interface Props {
  root: PitchClass;
  frets: Frets;
  /** Width in px; height follows. */
  width?: number;
}

const ROWS = 4;
const SX = (i: number) => 22 + i * 11.2;
const FRET_TOP = 32;
const ROW_H = 18;

/** Classic vertical chord box: x/o above the nut, dots, barre bar and a base-fret label. */
export function ChordDiagram({ root, frets, width = 84 }: Props) {
  const fretted = frets.filter((f) => f > 0);
  const min = fretted.length ? Math.min(...fretted) : 1;
  const base = min >= 2 ? min : 1;
  const { barre } = fingeringOf(frets);
  const bottom = FRET_TOP + ROWS * ROW_H;

  return (
    <svg className="diagram" width={width} viewBox={`0 0 88 ${bottom + 8}`} role="img" aria-label={`Digitación ${frets.map((f) => (f < 0 ? 'x' : f)).join(' ')}`}>
      {/* frets */}
      {Array.from({ length: ROWS + 1 }, (_, i) => (
        <line key={i} x1={SX(0)} x2={SX(5)} y1={FRET_TOP + i * ROW_H} y2={FRET_TOP + i * ROW_H} className={i === 0 && base === 1 ? 'dg-nut' : 'dg-fret'} />
      ))}
      {/* strings */}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={SX(i)} x2={SX(i)} y1={FRET_TOP} y2={bottom} className="dg-string" />
      ))}
      {base > 1 && <text x={SX(0) - 6} y={FRET_TOP + ROW_H / 2 + 4} textAnchor="end" className="dg-base">{base}</text>}
      {/* barre */}
      {barre && (
        <rect
          x={SX(barre.from) - 5}
          y={FRET_TOP + (barre.fret - base) * ROW_H + 3}
          width={SX(barre.to) - SX(barre.from) + 10}
          height={ROW_H - 6}
          rx={6}
          className="dg-barre"
        />
      )}
      {frets.map((f, s) => {
        const x = SX(s);
        if (f < 0) return <text key={s} x={x} y={FRET_TOP - 10} textAnchor="middle" className="dg-x">×</text>;
        if (f === 0) return <circle key={s} cx={x} cy={FRET_TOP - 13} r={3.6} className={stringPc(s, 0) === root ? 'dg-open root' : 'dg-open'} />;
        if (barre && f === barre.fret && s >= barre.from && s <= barre.to) return null;
        return <circle key={s} cx={x} cy={FRET_TOP + (f - base) * ROW_H + ROW_H / 2} r={5.2} className={stringPc(s, f) === root ? 'dg-dot root' : 'dg-dot'} />;
      })}
    </svg>
  );
}
