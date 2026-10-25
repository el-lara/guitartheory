import { positionPc, regionPositions } from '../fretboard/fretboard';
import { BOX_SPAN } from '../fretboard/scaleBox';
import { noteName, SCALES, scalePcs, type PitchClass, type ScaleType } from '../theory';
import type { Marker } from './Fretboard';

/** Every note of the scale on frets 0–12; with a box, notes outside the window are dimmed. */
export function scaleMarkers(tonic: PitchClass, type: ScaleType, box: number | null, labels: 'notes' | 'degrees' = 'notes'): Marker[] {
  const pcs = scalePcs(tonic, type);
  const degrees = SCALES[type].degrees;
  const out: Marker[] = [];
  for (const pos of regionPositions({ fretMin: 0, fretMax: 12 })) {
    const pc = positionPc(pos);
    const i = pcs.indexOf(pc);
    if (i < 0) continue;
    const inBox = box === null || (pos.fret >= box && pos.fret <= box + BOX_SPAN);
    out.push({ pos, kind: !inBox ? 'dim' : pc === tonic ? 'deg1' : 'deg5', label: labels === 'notes' ? noteName(pc) : degrees[i] });
  }
  return out;
}
