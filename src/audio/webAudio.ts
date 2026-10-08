import type { AudioEngine } from './audio';

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Synthesised plucked-string sound (no samples): sawtooth through a closing low-pass filter. */
export class WebAudioEngine implements AudioEngine {
  private ctx: AudioContext | null = null;
  muted = false;

  private context(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private pluck(midi: number, delay = 0) {
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const f = freq(midi);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(f * 8, 6000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 300), t + 0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    osc.connect(lp).connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.5);
  }

  playNote(midi: number) {
    this.pluck(midi);
  }

  playInterval(fromMidi: number, toMidi: number, mode: 'melodic' | 'harmonic') {
    this.pluck(fromMidi);
    this.pluck(toMidi, mode === 'melodic' ? 0.45 : 0);
  }

  playChord(midis: number[], strum = true) {
    [...midis].sort((a, b) => a - b).forEach((m, i) => this.pluck(m, strum ? i * 0.07 : 0));
  }
}

export const audio = new WebAudioEngine();

try {
  audio.muted = localStorage.getItem('fretquest:muted') === '1';
} catch {
  /* ignore */
}

export function setMuted(m: boolean) {
  audio.muted = m;
  try {
    localStorage.setItem('fretquest:muted', m ? '1' : '0');
  } catch {
    /* ignore */
  }
}
