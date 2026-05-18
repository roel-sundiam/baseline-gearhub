import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SoundService {
  readonly muted = signal(localStorage.getItem('courtgo-muted') === 'true');

  private ctx: AudioContext | null = null;

  constructor() {
    // Resume context on first user gesture (browser autoplay policy)
    const resume = () => { this.ctx?.resume(); };
    document.addEventListener('click', resume, { once: false });
    document.addEventListener('keydown', resume, { once: false });
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.ctx;
  }

  private tone(freq: number, dur: number, vol = 0.28, delay = 0, type: OscillatorType = 'sine'): void {
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    } catch { /* ignore on browsers without Web Audio */ }
  }

  /** Two-tone ding — new update / incoming notification */
  notification(): void {
    if (this.muted()) return;
    this.tone(880, 0.18, 0.22);
    this.tone(1108, 0.28, 0.22, 0.20);
  }

  /** Ascending three-note chime — success / saved / approved */
  success(): void {
    if (this.muted()) return;
    this.tone(523, 0.12, 0.20);           // C5
    this.tone(659, 0.12, 0.20, 0.13);     // E5
    this.tone(784, 0.22, 0.20, 0.26);     // G5
  }

  /** Descending two-note — error / rejected / failed */
  error(): void {
    if (this.muted()) return;
    this.tone(440, 0.18, 0.25);
    this.tone(330, 0.32, 0.25, 0.20);
  }

  /** Short soft pop — button confirm / minor action */
  pop(): void {
    if (this.muted()) return;
    this.tone(600, 0.08, 0.18, 0, 'triangle');
  }

  toggleMute(): void {
    this.muted.update(v => !v);
    localStorage.setItem('courtgo-muted', String(this.muted()));
  }
}
