import {
  Component, OnDestroy, AfterViewInit, ChangeDetectorRef,
  ElementRef, ViewChild, output,
} from '@angular/core';
import type jsQRType from 'jsqr';

/**
 * In-app QR scanner for hosted-play self-check-in. Opens the device camera via
 * getUserMedia (works in browser, PWA, and the Capacitor webview), decodes
 * frames with jsQR, and emits { s, t } once a CourtGo check-in URL is read.
 * Non-check-in codes show a hint and scanning continues.
 */
@Component({
  selector: 'app-qr-scanner-modal',
  standalone: true,
  template: `
    <div class="scan-backdrop" (click)="close()">
      <div class="scan-card" (click)="$event.stopPropagation()">
        <div class="scan-head">
          <span class="scan-title"><i class="fas fa-qrcode"></i> Scan Check-In Code</span>
          <button class="scan-close" (click)="close()" aria-label="Close scanner"><i class="fas fa-times"></i></button>
        </div>

        @if (error) {
          <div class="scan-error">
            <i class="fas fa-video-slash"></i>
            <p>{{ error }}</p>
            <p class="scan-error-hint">You can also scan the code with your phone's camera app.</p>
          </div>
        } @else {
          <div class="scan-viewport">
            <video #video autoplay playsinline muted></video>
            <div class="scan-frame"></div>
            @if (!streaming) {
              <div class="scan-loading"><i class="fas fa-circle-notch fa-spin"></i> Starting camera…</div>
            }
          </div>
          <p class="scan-hint">
            @if (wrongCode) {
              <span class="scan-wrong"><i class="fas fa-exclamation-triangle"></i> Not a check-in code — try the session QR.</span>
            } @else {
              Point your camera at the session's QR code.
            }
          </p>
        }
      </div>
    </div>
  `,
  styles: [`
    .scan-backdrop {
      position: fixed;
      inset: 0;
      z-index: 120;
      background: rgba(0,0,0,.72);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .scan-card {
      width: 100%;
      max-width: 380px;
      padding: 1.1rem;
      display: flex;
      flex-direction: column;
      gap: .8rem;
      background: #12251d;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 8px;
      box-shadow: 0 24px 70px rgba(0,0,0,.58);
      color: #fff;
    }
    .scan-head { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
    .scan-title { font-weight: 950; font-size: 1rem; display: inline-flex; align-items: center; gap: .5rem; }
    .scan-title i { color: #a3e635; }
    .scan-close {
      width: 32px; height: 32px; padding: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 6px; border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.06); color: rgba(255,255,255,.62); cursor: pointer;
    }
    .scan-viewport {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      border-radius: 8px;
      overflow: hidden;
      background: #07130d;
    }
    .scan-viewport video { width: 100%; height: 100%; object-fit: cover; }
    .scan-frame {
      position: absolute;
      inset: 14%;
      border: 2px solid rgba(163,230,53,.75);
      border-radius: 10px;
      pointer-events: none;
      mask: linear-gradient(#000 0 0);
    }
    .scan-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: .5rem;
      color: rgba(255,255,255,.62);
      font-size: .88rem;
    }
    .scan-hint { margin: 0; text-align: center; font-size: .82rem; color: rgba(255,255,255,.62); min-height: 1.2em; }
    .scan-wrong { color: #f59e0b; display: inline-flex; align-items: center; gap: .4rem; }
    .scan-error { text-align: center; padding: 1.2rem .5rem; }
    .scan-error i { font-size: 1.6rem; color: #f87171; }
    .scan-error p { margin: .7rem 0 0; font-size: .88rem; line-height: 1.45; }
    .scan-error-hint { color: rgba(255,255,255,.62); font-size: .8rem; }
  `],
})
export class QrScannerModalComponent implements AfterViewInit, OnDestroy {
  scanned = output<{ s: string; t: string }>();
  closed = output<void>();

  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  streaming = false;
  error = '';
  wrongCode = false;

  private stream: MediaStream | null = null;
  private jsQR: typeof jsQRType | null = null; // lazy-loaded so the page chunk stays small
  private decodeTimer: ReturnType<typeof setInterval> | null = null;
  private wrongCodeTimer: ReturnType<typeof setTimeout> | null = null;
  private canvas = document.createElement('canvas');
  private done = false;

  constructor(private cdr: ChangeDetectorRef) {}

  async ngAfterViewInit() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error = 'Camera access is not supported here.';
      this.cdr.detectChanges();
      return;
    }
    this.jsQR = (await import('jsqr')).default;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch {
      this.error = 'Camera access was blocked. Allow camera permission and try again.';
      this.cdr.detectChanges();
      return;
    }
    const video = this.videoRef?.nativeElement;
    if (!video) return;
    video.srcObject = this.stream;
    try { await video.play(); } catch { /* autoplay quirks — decode loop still reads frames */ }
    this.streaming = true;
    this.cdr.detectChanges();
    // ~4 fps is plenty for a printed code and keeps CPU/battery low.
    this.decodeTimer = setInterval(() => this.decodeFrame(), 250);
  }

  private decodeFrame() {
    const video = this.videoRef?.nativeElement;
    if (this.done || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    // Downscale to cap decode cost on high-res cameras.
    const scale = Math.min(1, 640 / (video.videoWidth || 640));
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    if (!this.jsQR) return;
    const image = ctx.getImageData(0, 0, w, h);
    const code = this.jsQR(image.data, w, h, { inversionAttempts: 'dontInvert' });
    if (!code?.data) return;
    this.handleDecoded(code.data);
  }

  private handleDecoded(text: string) {
    let s = '';
    let t = '';
    try {
      const url = new URL(text, location.origin);
      if (url.pathname.endsWith('/player/hosted-play/check-in')) {
        s = url.searchParams.get('s') || '';
        t = url.searchParams.get('t') || '';
      }
    } catch { /* not a URL — falls through to the wrong-code hint */ }

    if (!s || !t) {
      // Some other QR — hint briefly and keep scanning.
      this.wrongCode = true;
      this.cdr.detectChanges();
      if (this.wrongCodeTimer) clearTimeout(this.wrongCodeTimer);
      this.wrongCodeTimer = setTimeout(() => {
        this.wrongCode = false;
        this.cdr.detectChanges();
      }, 2500);
      return;
    }
    this.done = true;
    this.stopCamera();
    this.scanned.emit({ s, t });
  }

  close() {
    this.stopCamera();
    this.closed.emit();
  }

  private stopCamera() {
    if (this.decodeTimer) { clearInterval(this.decodeTimer); this.decodeTimer = null; }
    if (this.wrongCodeTimer) { clearTimeout(this.wrongCodeTimer); this.wrongCodeTimer = null; }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.streaming = false;
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}
