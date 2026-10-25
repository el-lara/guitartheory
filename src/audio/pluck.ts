import { mulberry32 } from '../util/rng';

export interface PluckOptions {
  /** Pick position along the string (0..0.5); changes the tone colour. */
  pickPosition?: number;
  seed?: number;
}

/** Ring time (T60, seconds) of a string: low strings ring longer. */
export const ringTime = (freq: number): number => Math.min(6, Math.max(1.6, 4.5 * (200 / freq) ** 0.4));

/**
 * Plucked-string synthesis (Karplus–Strong): a burst of noise circulating in a delay line whose
 * length sets the pitch, with a low-pass in the loop so the bright attack fades into a warm tone,
 * as on a real guitar string. A fractional-delay all-pass keeps the pitch accurate (it is used
 * as a tuning reference, so notes must be in tune to a fraction of a cent).
 */
export function pluckSamples(sampleRate: number, freq: number, seconds: number, opts: PluckOptions = {}): Float32Array {
  const total = Math.floor(sampleRate * seconds);
  const out = new Float32Array(total);

  // loop delay = L (integer line) + 0.5 (two-point average) + d (all-pass fraction)
  const target = sampleRate / freq - 0.5;
  let L = Math.floor(target);
  let d = target - L;
  if (d < 0.1) {
    L -= 1;
    d += 1;
  }
  const C = (1 - d) / (1 + d);

  // excitation: softened noise with a comb for the pick position
  const rng = mulberry32(opts.seed ?? 1);
  const noise = new Float32Array(L);
  let soft = 0;
  for (let i = 0; i < L; i++) {
    soft = 0.55 * (rng() * 2 - 1) + 0.45 * soft;
    noise[i] = soft;
  }
  const shift = Math.max(1, Math.round(L * (opts.pickPosition ?? 0.14)));
  const buf = new Float32Array(L);
  let mean = 0;
  for (let i = 0; i < L; i++) {
    buf[i] = noise[i] - noise[(i + shift) % L];
    mean += buf[i];
  }
  mean /= L;
  for (let i = 0; i < L; i++) buf[i] -= mean;

  const gain = 10 ** (-3 / (ringTime(freq) * freq)); // loop gain giving the wanted T60
  let prev = 0;
  let apX = 0;
  let apY = 0;
  let idx = 0;
  let peak = 0;
  for (let n = 0; n < total; n++) {
    const cur = buf[idx];
    out[n] = cur;
    const lp = gain * 0.5 * (cur + prev);
    prev = cur;
    const ap = C * lp + apX - C * apY;
    apX = lp;
    apY = ap;
    buf[idx] = ap;
    idx = idx + 1 === L ? 0 : idx + 1;
    const a = Math.abs(cur);
    if (a > peak) peak = a;
  }

  const norm = peak > 0 ? 0.9 / peak : 1;
  const fade = Math.min(total, Math.floor(sampleRate * 0.08));
  for (let n = 0; n < total; n++) {
    const f = n >= total - fade ? (total - n) / fade : 1;
    out[n] *= norm * f;
  }
  return out;
}
