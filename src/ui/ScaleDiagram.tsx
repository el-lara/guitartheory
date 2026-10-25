import type { ReactElement } from 'react';
import { positionPc, STANDARD_TUNING } from '../fretboard/fretboard';
import { BOX_SPAN } from '../fretboard/scaleBox';
import { scalePcs, type PitchClass, type ScaleType } from '../theory';

interface Props {
  tonic: PitchClass;
  type: ScaleType;
  box: number | null;
  width?: number;
}

const STRINGS = STANDARD_TUNING.strings.length;

/** Small horizontal neck: only the box when there is one, the whole 0–12 neck otherwise. */
export function ScaleDiagram({ tonic, type, box, width = 150 }: Props) {
  const a = box ?? 0;
  const b = box === null ? 12 : box + BOX_SPAN;
  const cols = b - a + 1;
  const cw = box === null ? 14 : 24;
  const gap = 12;
  const padL = 4;
  const padT = 8;
  const W = padL + cols * cw + 4;
  const H = padT + (STRINGS - 1) * gap + 22;
  const pcs = scalePcs(tonic, type);
  const labelled = (f: number) => (box === null ? [0, 3, 5, 7, 9, 12].includes(f) : true);

  const dots: ReactElement[] = [];
  for (let s = 0; s < STRINGS; s++) {
    for (let f = a; f <= b; f++) {
      const pc = positionPc({ string: s, fret: f });
      if (!pcs.includes(pc)) continue;
      dots.push(
        <circle key={`${s}:${f}`} cx={padL + (f - a + 0.5) * cw} cy={padT + (STRINGS - 1 - s) * gap} r={box === null ? 3.6 : 5} className={pc === tonic ? 'sd-dot root' : 'sd-dot'} />,
      );
    }
  }

  return (
    <svg className="diagram scale-diagram" width={width} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Escala en el mástil">
      <rect x={padL} y={padT - 6} width={cols * cw} height={(STRINGS - 1) * gap + 12} className="sd-wood" rx={3} />
      {Array.from({ length: cols + 1 }, (_, i) => (
        <line key={i} x1={padL + i * cw} x2={padL + i * cw} y1={padT - 6} y2={padT + (STRINGS - 1) * gap + 6} className={i === 0 && a === 0 ? 'sd-nut' : 'sd-fret'} />
      ))}
      {Array.from({ length: STRINGS }, (_, s) => (
        <line key={s} x1={padL} x2={padL + cols * cw} y1={padT + s * gap} y2={padT + s * gap} className="sd-string" />
      ))}
      {dots}
      {Array.from({ length: cols }, (_, i) =>
        labelled(a + i) ? (
          <text key={i} x={padL + (i + 0.5) * cw} y={H - 4} textAnchor="middle" className="sd-num">{a + i}</text>
        ) : null,
      )}
    </svg>
  );
}
