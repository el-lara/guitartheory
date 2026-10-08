import { useEffect, useRef, useState } from 'react';
import { positionNote, stringOrdinal, STANDARD_TUNING, type Position, type Region } from '../fretboard/fretboard';

export type MarkerKind = 'target' | 'step' | 'deg1' | 'deg3' | 'deg5' | 'dim' | 'hint' | 'found' | 'locked' | 'origin' | 'mark' | 'reveal' | 'solution' | 'wrong';
export interface Marker {
  pos: Position;
  kind: MarkerKind;
  label?: string;
}

interface Props {
  fretMax: number;
  markers: Marker[];
  highlight?: Region | null;
  disabled?: boolean;
  /** Draw every note name on the neck. */
  showNotes?: boolean;
  onPlay: (pos: Position) => void;
}

const SINGLE_INLAYS = [3, 5, 7, 9];
const STRINGS = STANDARD_TUNING.strings.length;

export function Fretboard({ fretMax, markers, highlight, disabled, showNotes, onPlay }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, el.clientWidth)));
    setW(Math.max(300, el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const leftPad = w < 520 ? 44 : 54;
  const openW = w < 520 ? 30 : 44;
  const rightPad = 10;
  const topPad = 12;
  const bottomPad = 30;
  const gap = Math.max(32, Math.min(46, w / 17));
  const fretW = (w - leftPad - openW - rightPad) / fretMax;
  const h = topPad + gap * (STRINGS - 1) + topPad + bottomPad;
  const nutX = leftPad + openW;
  const lineX = (f: number) => nutX + f * fretW; // right edge of fret f cell (f>=1)
  const cellLeft = (f: number) => (f === 0 ? leftPad : lineX(f - 1));
  const cellRight = (f: number) => (f === 0 ? nutX : lineX(f));
  const cx = (f: number) => (f === 0 ? leftPad + openW / 2 : nutX + (f - 0.5) * fretW);
  const rowY = (s: number) => topPad + (STRINGS - 1 - s) * gap; // 1ª string on top
  const r = Math.min(gap, fretW, 52) * 0.4;
  const boardTop = topPad - gap / 2;
  const boardH = gap * STRINGS;

  const cells: Position[] = [];
  for (let s = 0; s < STRINGS; s++) for (let f = 0; f <= fretMax; f++) cells.push({ string: s, fret: f });

  return (
    <div className="board" ref={ref}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Mástil de guitarra">
        {/* wood */}
        <rect x={nutX} y={boardTop} width={w - nutX - rightPad} height={boardH} rx={6} className="wood" />
        <rect x={leftPad} y={boardTop} width={openW} height={boardH} className="headstock" />
        {/* inlays */}
        {SINGLE_INLAYS.filter((f) => f <= fretMax).map((f) => (
          <circle key={f} cx={cx(f)} cy={topPad + (gap * (STRINGS - 1)) / 2} r={Math.min(7, fretW * 0.12)} className="inlay" />
        ))}
        {fretMax >= 12 && (
          <>
            <circle cx={cx(12)} cy={topPad + gap * 1.5} r={Math.min(7, fretW * 0.12)} className="inlay" />
            <circle cx={cx(12)} cy={topPad + gap * 3.5} r={Math.min(7, fretW * 0.12)} className="inlay" />
          </>
        )}
        {/* region highlight */}
        {highlight && (
          <rect
            className="region"
            x={cellLeft(highlight.fretMin) + 1}
            width={cellRight(Math.min(fretMax, highlight.fretMax)) - cellLeft(highlight.fretMin) - 2}
            y={highlight.strings ? rowY(Math.max(...highlight.strings)) - gap / 2 : boardTop}
            height={highlight.strings ? gap * highlight.strings.length : boardH}
            rx={6}
          />
        )}
        {/* frets */}
        {Array.from({ length: fretMax }, (_, i) => i + 1).map((f) => (
          <line key={f} x1={lineX(f)} x2={lineX(f)} y1={boardTop} y2={boardTop + boardH} className="fret" />
        ))}
        <line x1={nutX} x2={nutX} y1={boardTop} y2={boardTop + boardH} className="nut" />
        {/* strings */}
        {Array.from({ length: STRINGS }, (_, s) => (
          <line key={s} x1={leftPad} x2={w - rightPad} y1={rowY(s)} y2={rowY(s)} className="string" strokeWidth={1 + (STRINGS - 1 - s) * 0.45} />
        ))}
        {/* tuning labels */}
        {Array.from({ length: STRINGS }, (_, s) => (
          <g key={s}>
            <text x={4} y={rowY(s) + 4} className="str-num">{stringOrdinal(s)}</text>
            <text x={leftPad - 8} y={rowY(s) + 5} textAnchor="end" className="str-note">{STANDARD_TUNING.strings[s].label}</text>
          </g>
        ))}
        {/* fret numbers */}
        {Array.from({ length: fretMax + 1 }, (_, f) => (
          <text key={f} x={cx(f)} y={h - 8} textAnchor="middle" className={`fret-num${[3, 5, 7, 9, 12].includes(f) ? ' key' : ''}`}>
            {f}
          </text>
        ))}
        {/* hit cells */}
        {cells.map((p) => (
          <g key={`${p.string}:${p.fret}`} className={`cell${disabled ? ' off' : ''}`} onPointerDown={(e) => { e.preventDefault(); if (!disabled) onPlay(p); }}>
            <rect x={cellLeft(p.fret)} y={rowY(p.string) - gap / 2} width={cellRight(p.fret) - cellLeft(p.fret)} height={gap} fill="transparent" />
            <circle cx={cx(p.fret)} cy={rowY(p.string)} r={r * 0.8} className="hover-dot" />
          </g>
        ))}
        {showNotes && cells.map((p) => {
          const n = positionNote(p);
          return (
            <text key={`n${p.string}:${p.fret}`} x={cx(p.fret)} y={rowY(p.string) + 4} textAnchor="middle" className={`note-label${n.includes('#') ? ' sharp' : ''}`}>{n}</text>
          );
        })}
        {/* markers */}
        {markers.map((m, i) => (
          <g key={`${m.kind}-${m.pos.string}-${m.pos.fret}-${i}`} className={`marker ${m.kind}`} transform={`translate(${cx(m.pos.fret)} ${rowY(m.pos.string)})`}>
            <circle r={m.kind === 'step' ? r * 0.55 : r} />
            <text y={4.5} textAnchor="middle">{m.kind === 'wrong' ? '✕' : m.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
