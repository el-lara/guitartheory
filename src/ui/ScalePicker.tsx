import { BOX_MAX_START, BOX_SPAN, defaultBoxStart } from '../fretboard/scaleBox';
import { NOTE_NAMES, SCALE_TYPES, SCALES, type PitchClass, type ScaleType } from '../theory';

export interface ScaleChoice {
  tonic: PitchClass;
  type: ScaleType;
  box: number | null;
}

/** Tonic, scale type and box controls, shared by the explorer and the in-place editor. */
export function ScalePicker({ value, onChange }: { value: ScaleChoice; onChange: (v: ScaleChoice) => void }) {
  const { tonic, type, box } = value;
  return (
    <>
      <div className="chips-row" role="group" aria-label="Tónica">
        {NOTE_NAMES.map((nm, pc) => (
          <button key={nm} className={`pill${pc === tonic ? ' sel' : ''}`} onClick={() => onChange({ ...value, tonic: pc, box: box === null ? null : defaultBoxStart(pc) })}>{nm}</button>
        ))}
      </div>
      <div className="chips-row" role="group" aria-label="Escala">
        {SCALE_TYPES.map((t) => (
          <button key={t} className={`pill wide${t === type ? ' sel' : ''}`} onClick={() => onChange({ ...value, type: t })}>{SCALES[t].name}</button>
        ))}
      </div>
      <div className="chips-row">
        <button className="pill" disabled={box === null || box <= 0} onClick={() => onChange({ ...value, box: Math.max(0, (box ?? 0) - 1) })}>‹</button>
        <button className={`pill wide${box !== null ? ' sel' : ''}`} onClick={() => onChange({ ...value, box: box === null ? defaultBoxStart(tonic) : null })}>
          {box === null ? 'Ver una caja' : `Caja: trastes ${box}–${box + BOX_SPAN}`}
        </button>
        <button className="pill" disabled={box === null || box >= BOX_MAX_START} onClick={() => onChange({ ...value, box: Math.min(BOX_MAX_START, (box ?? 0) + 1) })}>›</button>
      </div>
    </>
  );
}
