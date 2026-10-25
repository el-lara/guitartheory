import { describe, expect, it } from 'vitest';
import { midiFreq } from '../theory';
import { pluckSamples, ringTime } from './pluck';

/**
 * Fundamental from the normalised autocorrelation peak near m periods (parabolic interpolation),
 * which averages out the sample grid: accurate to a small fraction of a cent.
 */
function measureFreq(x: Float32Array, sr: number, f: number, startSec = 0.3): number {
  const m = Math.max(1, Math.round(0.06 * f)); // ~60 ms worth of periods
  const start = Math.floor(startSec * sr);
  const len = Math.floor(0.4 * sr);
  const r = (lag: number) => {
    let xy = 0, xx = 0, yy = 0;
    for (let n = start; n < start + len; n++) {
      xy += x[n] * x[n + lag];
      xx += x[n] * x[n];
      yy += x[n + lag] * x[n + lag];
    }
    return xy / Math.sqrt(xx * yy);
  };
  const guess = Math.round((m * sr) / f);
  let best = guess;
  let bestR = -2;
  for (let lag = guess - 6; lag <= guess + 6; lag++) {
    const v = r(lag);
    if (v > bestR) { bestR = v; best = lag; }
  }
  const y0 = r(best - 1), y1 = r(best), y2 = r(best + 1);
  const off = (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2);
  return (m * sr) / (best + off);
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

describe('pluck synthesis', () => {
  for (const sr of [44100, 48000]) {
    for (const midi of [40, 45, 50, 55, 59, 64, 76]) {
      it(`midi ${midi} @ ${sr} Hz is in tune (±1 cent)`, () => {
        const f = midiFreq(midi);
        const x = pluckSamples(sr, f, 1.6);
        expect(Math.abs(cents(measureFreq(x, sr, f), f))).toBeLessThan(1);
      });
    }
  }
  it('is deterministic, bounded, decays and gets darker', () => {
    const sr = 44100;
    const a = pluckSamples(sr, 110, 2);
    const b = pluckSamples(sr, 110, 2);
    expect(a).toEqual(b);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(0.9001);
    const rms = (from: number, to: number) => Math.sqrt(a.slice(from, to).reduce((s, v) => s + v * v, 0) / (to - from));
    expect(rms(sr * 1.5, sr * 1.7)).toBeLessThan(rms(0, sr * 0.2) * 0.6); // it decays
    // brightness: high-frequency content (first difference) shrinks relative to the signal
    const hf = (from: number, to: number) => {
      let d = 0, e = 0;
      for (let n = from + 1; n < to; n++) { d += (a[n] - a[n - 1]) ** 2; e += a[n] ** 2; }
      return d / e;
    };
    expect(hf(sr * 1.2, sr * 1.4)).toBeLessThan(hf(0, sr * 0.1));
  });
  it('low strings ring longer than high strings', () => {
    expect(ringTime(82)).toBeGreaterThan(ringTime(660));
  });
});
