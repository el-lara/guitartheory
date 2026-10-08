import { useEffect } from 'react';
import { Fretboard, type Marker } from './Fretboard';
import { game } from './useGame';
import { positionNote } from '../fretboard/fretboard';
import { intervalName } from '../theory';
import { MAX_LIVES, type Snapshot } from '../game/Game';

function markersFor(s: Snapshot): Marker[] {
  const ch = s.challenge;
  if (!ch || !s.progress) return [];
  const step = ch.steps[s.stepIndex];
  const out: Marker[] = [];
  const p = s.progress;
  if (s.revealMsLeft > 0 && step.reveal) {
    for (const pos of step.reveal.positions) out.push({ pos, kind: 'reveal', label: positionNote(pos) });
    return out;
  }
  if (p.type === 'note') for (const pos of p.found) out.push({ pos, kind: 'found', label: positionNote(pos) });
  if (p.type === 'interval') {
    if (p.origin) out.push({ pos: p.origin, kind: 'origin', label: positionNote(p.origin) });
    for (const pos of p.targets) out.push({ pos, kind: 'found', label: positionNote(pos) });
  }
  if (p.type === 'chord' && step.spec.type === 'chord') {
    const locked = step.spec.locked;
    for (const pos of p.selected) {
      const isLocked = locked.some((l) => l.string === pos.string && l.fret === pos.fret);
      out.push({ pos, kind: isLocked ? 'locked' : 'found', label: positionNote(pos) });
    }
  }
  if (step.spec.type === 'choice') {
    out.push({ pos: step.spec.marks[0], kind: 'mark', label: '1' }, { pos: step.spec.marks[1], kind: 'mark', label: '2' });
  }
  for (const pos of s.solution) out.push({ pos, kind: 'solution', label: positionNote(pos) });
  if (s.flash) out.push({ pos: s.flash.pos, kind: 'wrong' });
  return out;
}

function fmt(ms: number) {
  const t = Math.ceil(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function Play({ s }: { s: Snapshot }) {
  const ch = s.challenge;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (s.phase === 'discovery' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        game.next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.phase]);

  if (!ch) return null;
  const step = ch.steps[s.stepIndex];
  const revealing = s.revealMsLeft > 0;
  const spec = step.spec;
  const progress = s.progress;
  const need = spec.type === 'note' || spec.type === 'interval' ? spec.need : 0;
  const done = progress?.type === 'note' ? progress.found.length : progress?.type === 'interval' ? progress.targets.length : 0;
  const highlight =
    (spec.type === 'note' || spec.type === 'interval' || spec.type === 'chord') &&
    (spec.region.fretMin > 0 || spec.region.fretMax < ch.fretMax || spec.region.strings)
      ? spec.region
      : null;
  const inDiscovery = s.phase === 'discovery';
  const timePct = s.challengeMsLeft !== null && ch.timeLimitMs ? (s.challengeMsLeft / ch.timeLimitMs) * 100 : null;

  return (
    <div className="play">
      <header className="hud">
        <div className="hud-left">
          <div className="lives" aria-label={`${s.lives} vidas`}>
            {Array.from({ length: MAX_LIVES }, (_, i) => (
              <span key={i} className={i < s.lives ? 'heart on' : 'heart'}>♥</span>
            ))}
          </div>
          <div className={`streak${s.streak >= 5 ? ' hot' : ''}`}>
            <b>{s.streak}</b> racha
          </div>
        </div>
        <div className="hud-center">
          <div className="clock">{fmt(s.sessionMsLeft)}</div>
          <div className="clock-bar"><i style={{ width: `${(s.sessionMsLeft / (s.config.minutes * 60000)) * 100}%` }} /></div>
        </div>
        <div className="hud-right">
          <div className="score">{s.score}</div>
          <button className="ghost" onClick={() => game.quit()}>Terminar</button>
        </div>
      </header>

      <section className="prompt-area">
        <div className="chips">
          <span className="chip">{ch.flavor}</span>
          {ch.steps.length > 1 && <span className="chip dim">paso {s.stepIndex + 1}/{ch.steps.length}</span>}
        </div>
        <h1 key={`${ch.id}-${s.stepIndex}-${revealing}`} className="prompt">{revealing && step.reveal ? step.reveal.prompt : step.prompt}</h1>
        {step.sub && !revealing && <p className="sub">{step.sub}</p>}
        {need > 1 && (
          <div className="dots">{Array.from({ length: need }, (_, i) => <i key={i} className={i < done ? 'on' : ''} />)}</div>
        )}
        {timePct !== null && <div className={`timer${timePct < 30 ? ' low' : ''}`}><i style={{ width: `${timePct}%` }} /></div>}
      </section>

      <Fretboard
        fretMax={ch.fretMax}
        markers={markersFor(s)}
        highlight={highlight}
        disabled={inDiscovery || revealing}
        onPlay={(pos) => game.click(pos)}
      />

      {spec.type === 'choice' && !inDiscovery && (
        <div className="choices">
          {spec.options.map((o, i) => (
            <button key={o} className="choice" onClick={() => game.choose(i)}>{intervalName(o)}</button>
          ))}
        </div>
      )}

      <section className="bottom">
        {inDiscovery && s.discovery ? (
          <div className={`discovery${s.discovery.fail ? ' fail' : ''}`}>
            {s.discovery.fail && <div className="disc-tag">Esta era la respuesta</div>}
            <div className="disc-head">{s.discovery.heading}</div>
            {s.discovery.lines.map((l, i) => <div key={i} className="disc-line">{l}</div>)}
            <button className="big" autoFocus onClick={() => game.next()}>Siguiente</button>
          </div>
        ) : (
          <>
            <div className="feedback-row">
              {s.feedback && <div key={s.feedback.id} className={`feedback ${s.feedback.kind}`}>{s.feedback.text}</div>}
            </div>
            <button className="ghost skip" onClick={() => game.skip()}>Rendirse (−1 ♥)</button>
          </>
        )}
      </section>
      {s.levelToast && <div key={s.levelToast.id} className="toast">{s.levelToast.text}</div>}
    </div>
  );
}
