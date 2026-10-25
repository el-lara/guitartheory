import type { AudioEngine } from './audio';
import { pluckSamples, ringTime } from './pluck';

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const MAX_SECONDS = 4.5;
const REPLUCK_SECONDS = 3.2;

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * Guitar-like sound without samples: each note is a physically modelled plucked string
 * (Karplus–Strong, see pluck.ts) played through a small "acoustic body" EQ and a compressor.
 */
export class WebAudioEngine implements AudioEngine {
  private ctx: AudioContext | null = null;
  private bus: AudioNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private tones: Voice[] = [];
  private toneTimer: number | null = null;
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

  /** Shared output: body resonances (~100 and ~220 Hz), a roll-off of the harshest highs, then a limiter-ish compressor. */
  private output(ctx: AudioContext): AudioNode {
    if (this.bus) return this.bus;
    const input = ctx.createGain();
    const body1 = ctx.createBiquadFilter();
    body1.type = 'peaking';
    body1.frequency.value = 100;
    body1.Q.value = 1.1;
    body1.gain.value = 5;
    const body2 = ctx.createBiquadFilter();
    body2.type = 'peaking';
    body2.frequency.value = 220;
    body2.Q.value = 1;
    body2.gain.value = 2.5;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 5500;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    input.connect(body1).connect(body2).connect(tone).connect(comp).connect(ctx.destination);
    this.bus = input;
    return input;
  }

  private buffer(ctx: AudioContext, midi: number): AudioBuffer {
    const key = `${ctx.sampleRate}:${midi}`;
    let buf = this.buffers.get(key);
    if (!buf) {
      const f = freq(midi);
      const seconds = Math.min(MAX_SECONDS, ringTime(f) * 0.9);
      const samples = pluckSamples(ctx.sampleRate, f, seconds, { seed: midi });
      buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buf.getChannelData(0).set(samples);
      this.buffers.set(key, buf);
    }
    return buf;
  }

  private pluck(midi: number, delay = 0, velocity = 1): Voice | null {
    const ctx = this.context();
    if (!ctx) return null;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(ctx, midi);
    const gain = ctx.createGain();
    gain.gain.value = 0.75 * velocity;
    src.connect(gain).connect(this.output(ctx));
    src.start(ctx.currentTime + delay);
    return { src, gain };
  }

  playNote(midi: number) {
    this.pluck(midi);
  }

  playInterval(fromMidi: number, toMidi: number, mode: 'melodic' | 'harmonic') {
    this.pluck(fromMidi);
    this.pluck(toMidi, mode === 'melodic' ? 0.55 : 0.02);
  }

  playChord(midis: number[], strum = true) {
    // a downward strum: lowest string first, a little softer and later as it goes up
    [...midis].sort((a, b) => a - b).forEach((m, i) => this.pluck(m, strum ? i * 0.045 : 0, 0.85 + (i % 2) * 0.1));
  }

  /**
   * Reference note for tuning: a plucked string that rings out. For long durations
   * ("hold") the string is plucked again every few seconds until `stopTones()`.
   */
  playTone(midi: number, seconds = 4) {
    this.stopTones();
    const first = this.pluck(midi);
    if (!first) return;
    this.tones.push(first);
    if (seconds > MAX_SECONDS + 1) {
      const started = performance.now();
      this.toneTimer = window.setInterval(() => {
        if (performance.now() - started > seconds * 1000) return this.stopTones();
        const v = this.pluck(midi);
        if (v) this.tones.push(v);
      }, REPLUCK_SECONDS * 1000);
    }
  }

  stopTones() {
    if (this.toneTimer !== null) {
      clearInterval(this.toneTimer);
      this.toneTimer = null;
    }
    const ctx = this.ctx;
    if (!ctx) return;
    for (const { src, gain } of this.tones) {
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
        src.stop(ctx.currentTime + 0.15);
      } catch {
        /* already finished */
      }
    }
    this.tones = [];
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
