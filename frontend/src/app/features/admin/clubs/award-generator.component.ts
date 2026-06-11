import {
  Component, Input, OnChanges, SimpleChanges,
  ViewChild, ElementRef, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Club } from '../../../core/services/club.service';

@Component({
  selector: 'app-award-generator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ag-wrap">

      <!-- ── FORM ── -->
      <div class="ag-form">

        <p class="ag-sec-hdr"><i class="fas fa-shield-alt"></i> Club</p>

        <label class="ag-lbl">Club Name
          <input class="ag-inp" type="text" [(ngModel)]="clubName" placeholder="Club name" />
        </label>
        <div class="ag-lbl">Logo
          <div class="ag-fp" [class.ag-fp-filled]="!!logoUrl" (click)="logoFileInput.click()">
            <input #logoFileInput type="file" accept="image/*" style="display:none" (change)="onLogoUpload($event)" />
            <div class="ag-fp-thumb">
              @if (logoUrl) {
                <img [src]="logoUrl" alt="Preview" class="ag-fp-img" />
              } @else {
                <i class="fas fa-image ag-fp-icon"></i>
              }
            </div>
            <div class="ag-fp-info">
              <span class="ag-fp-name" [class.ag-fp-placeholder]="!logoFileName">{{ logoFileName || 'No image chosen' }}</span>
              <span class="ag-fp-hint">PNG · JPG · WEBP</span>
            </div>
            <span class="ag-fp-action">Browse</span>
          </div>
        </div>

        <p class="ag-sec-hdr"><i class="fas fa-award"></i> Award</p>

        <label class="ag-lbl">Award Title <span class="ag-req">*</span>
          <input class="ag-inp" type="text" [(ngModel)]="awardTitle" placeholder="PLAQUE OF RECOGNITION" />
        </label>
        <label class="ag-lbl">Result <span class="ag-req">*</span>
          <select class="ag-inp" [(ngModel)]="result">
            <option>Champion</option>
            <option>Runner-Up</option>
            <option>2nd Runner-Up</option>
            <option>Finalist</option>
          </select>
        </label>
        <label class="ag-lbl">Category <span class="ag-req">*</span>
          <input class="ag-inp" type="text" [(ngModel)]="category" placeholder="e.g. Women's Doubles" />
        </label>

        <p class="ag-sec-hdr"><i class="fas fa-user"></i> Participant <em>optional</em></p>

        <label class="ag-lbl">Player Name
          <input class="ag-inp" type="text" [(ngModel)]="playerName" placeholder="Full name" />
        </label>

        <p class="ag-sec-hdr"><i class="fas fa-calendar-alt"></i> Event</p>

        <label class="ag-lbl">Location <span class="ag-req">*</span>
          <input class="ag-inp" type="text" [(ngModel)]="location" placeholder="Venue name" />
        </label>
        <label class="ag-lbl">Date <span class="ag-req">*</span>
          <input class="ag-inp" type="date" [(ngModel)]="date" />
        </label>

        <p class="ag-sec-hdr"><i class="fas fa-palette"></i> Appearance</p>

        <label class="ag-lbl">Primary Color
          <div class="ag-color-row">
            <input type="color" [(ngModel)]="primaryColor" class="ag-color" />
            <span class="ag-color-val">{{ primaryColor }}</span>
          </div>
        </label>
        <div class="ag-lbl">Bottom Image <span class="ag-req">*</span>
          <div class="ag-fp" [class.ag-fp-filled]="!!courtImage" (click)="courtFileInput.click()">
            <input #courtFileInput type="file" accept="image/*" style="display:none" (change)="onCourtImageUpload($event)" />
            <div class="ag-fp-thumb">
              @if (courtImage) {
                <img [src]="courtImage" alt="Preview" class="ag-fp-img" />
              } @else {
                <i class="fas fa-arrow-up-from-bracket ag-fp-icon"></i>
              }
            </div>
            <div class="ag-fp-info">
              <span class="ag-fp-name" [class.ag-fp-placeholder]="!courtFileName">{{ courtFileName || 'No image chosen' }}</span>
              <span class="ag-fp-hint">PNG · JPG · WEBP</span>
            </div>
            <span class="ag-fp-action">Browse</span>
          </div>
        </div>

        <button class="ag-dl-btn" (click)="download()" [disabled]="!isValid || isDownloading">
          @if (isDownloading) {
            <i class="fas fa-circle-notch fa-spin"></i> Exporting…
          } @else {
            <i class="fas fa-download"></i> Download PNG
          }
        </button>

        @if (!isValid) {
          <p class="ag-hint">Fill all <span class="ag-req">*</span> fields to enable download.</p>
        }

      </div>

      <!-- ── PREVIEW ── -->
      <div class="ag-preview-col">
        <p class="ag-preview-lbl">Live Preview <span class="ag-preview-dim">600 × 800 px</span></p>
        <div class="ag-preview-scroll">

          <!-- The #preview div is 600×800 — html2canvas captures it at native size × 2 -->
          <div #preview [ngStyle]="plaqueStyle">

            <!-- Outer gold border frame -->
            <div [ngStyle]="outerBorderStyle"></div>

            <!-- Corner ornaments (4) -->
            <div [ngStyle]="cornerStyle('top','left')"></div>
            <div [ngStyle]="cornerStyle('top','right')"></div>
            <div [ngStyle]="cornerStyle('bottom','left')"></div>
            <div [ngStyle]="cornerStyle('bottom','right')"></div>

            <!-- Club banner (logo circle + club name) -->
            <div [ngStyle]="clubBannerStyle">
              @if (logoUrl) {
                <div [ngStyle]="{ width:'122px', height:'122px', borderRadius:'50%', overflow:'hidden', flexShrink:'0' }">
                  <img [src]="logoUrl" alt="Club logo" crossorigin="anonymous"
                    [ngStyle]="{ width:'100%', height:'100%', objectFit:'cover' }" />
                </div>
              }
              <div [ngStyle]="clubNameTextStyle">{{ clubName || 'CLUB NAME' }}</div>
            </div>

            <!-- Diamond rule (top) -->
            <div [ngStyle]="{ display:'flex', alignItems:'center', width:'82%', margin:'0 0 14px' }">
              <div [ngStyle]="{ flex:'1', height:'1px', backgroundColor:GOLD }"></div>
              <div [ngStyle]="diamondDotStyle"></div>
              <div [ngStyle]="{ flex:'1', height:'1px', backgroundColor:GOLD }"></div>
            </div>

            <!-- "Award This" label -->
            <div [ngStyle]="{ fontFamily:SANS, fontSize:'10px', fontWeight:'400', letterSpacing:'0.28em', color:'#000', textTransform:'uppercase', marginBottom:'6px' }">Award This</div>

            <!-- Award Title -->
            <div [ngStyle]="{ fontFamily:SERIF, fontSize:'27px', fontWeight:'700', letterSpacing:'0.08em', color:DARK, textTransform:'uppercase', textAlign:'center', lineHeight:'1.2', marginBottom:'12px' }">
              {{ awardTitle || 'AWARD TITLE' }}
            </div>

            <!-- "For Being A" label rule -->
            <div [ngStyle]="{ display:'flex', alignItems:'center', gap:'12px', width:'60%' }">
              <div [ngStyle]="{ flex:'1', height:'1px', backgroundColor:'#aaa' }"></div>
              <span [ngStyle]="{ fontFamily:SANS, fontSize:'10px', letterSpacing:'0.28em', color:'#000', whiteSpace:'nowrap', textTransform:'uppercase' }">For Being A</span>
              <div [ngStyle]="{ flex:'1', height:'1px', backgroundColor:'#aaa' }"></div>
            </div>

            <!-- Player Name (optional) -->
            @if (playerName) {
              <div [ngStyle]="{ fontFamily:SERIF, fontSize:'22px', fontWeight:'600', fontStyle:'italic', color:DARK, marginTop:'12px', marginBottom:'2px', letterSpacing:'0.04em', textAlign:'center' }">
                {{ playerName }}
              </div>
            }

            <!-- Result — large focal text -->
            <div [ngStyle]="resultStyle">{{ result || 'Champion' }}</div>

            <!-- Category -->
            <div [ngStyle]="{ fontFamily:SANS, fontSize:'17px', fontWeight:'700', letterSpacing:'0.2em', color:GREEN, textTransform:'uppercase', textAlign:'center' }">
              {{ category }}
            </div>

            <!-- Court image (optional) -->
            @if (courtImage) {
              <div [ngStyle]="{ marginTop:'14px', width:'260px', height:'180px', flexShrink:'0' }">
                <img [src]="courtImage" alt="Court" crossorigin="anonymous"
                  [ngStyle]="{ width:'100%', height:'100%', objectFit:'contain', opacity:'0.88' }" />
              </div>
            }

            <!-- Spacer pushes footer down -->
            <div style="flex:1"></div>

            <!-- Diamond rule (bottom) -->
            <div [ngStyle]="{ display:'flex', alignItems:'center', width:'50%', margin:'0 0 18px' }">
              <div [ngStyle]="{ flex:'1', height:'1px', backgroundColor:GOLD }"></div>
              <div [ngStyle]="diamondDotStyle"></div>
              <div [ngStyle]="{ flex:'1', height:'1px', backgroundColor:GOLD }"></div>
            </div>

            <!-- Location with pin icon -->
            <div [ngStyle]="{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'10px' }">
              <svg width="11" height="15" viewBox="0 0 10 14" fill="none">
                <path d="M5 0C2.24 0 0 2.24 0 5c0 3.75 5 9 5 9s5-5.25 5-9C10 2.24 7.76 0 5 0zm0 6.75A1.75 1.75 0 113.25 5 1.75 1.75 0 015 6.75z" [attr.fill]="GOLD_DOT" />
              </svg>
              <span [ngStyle]="{ fontFamily:SANS, fontSize:'15px', fontWeight:'700', letterSpacing:'0.18em', color:GREEN, textTransform:'uppercase' }">{{ location }}</span>
            </div>

            <!-- Date with decorative dots -->
            @if (date) {
              <div [ngStyle]="{ display:'flex', alignItems:'center', gap:'10px' }">
                <div [ngStyle]="{ display:'flex', alignItems:'center', gap:'5px' }">
                  <div [ngStyle]="{ width:'16px', height:'1px', backgroundColor:GOLD_DOT }"></div>
                  <div [ngStyle]="{ width:'4px', height:'4px', borderRadius:'50%', backgroundColor:GOLD_DOT }"></div>
                </div>
                <span [ngStyle]="{ fontFamily:SANS, fontSize:'15px', fontWeight:'700', letterSpacing:'0.18em', color:'#000', textTransform:'uppercase' }">{{ formatDate(date) }}</span>
                <div [ngStyle]="{ display:'flex', alignItems:'center', gap:'5px' }">
                  <div [ngStyle]="{ width:'4px', height:'4px', borderRadius:'50%', backgroundColor:GOLD_DOT }"></div>
                  <div [ngStyle]="{ width:'16px', height:'1px', backgroundColor:GOLD_DOT }"></div>
                </div>
              </div>
            }

          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .ag-wrap {
      display: flex;
      gap: 24px;
      padding: 20px 20px 28px;
      align-items: flex-start;
    }

    /* ── FORM ── */
    .ag-form {
      width: 256px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .ag-sec-hdr {
      margin: 14px 0 6px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--dm-muted, #888);
      padding-bottom: 5px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .ag-sec-hdr:first-child { margin-top: 0; }
    .ag-sec-hdr em { font-style: normal; font-weight: 400; opacity: 0.55; margin-left: 4px; }

    .ag-lbl {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: 0.7rem;
      font-weight: 500;
      color: var(--dm-muted, #999);
    }

    .ag-inp {
      background: var(--dm-surface, #1e2329);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 7px 10px;
      font-size: 0.8rem;
      color: var(--dm-text, #fff);
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .ag-inp:focus { outline: none; border-color: var(--dm-accent, #a3e635); }
    .ag-inp option { background: #1e2329; color: #fff; }

    /* ── File picker ── */
    .ag-fp {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--dm-surface, #1e2329);
      border: 1px dashed rgba(255,255,255,0.14);
      border-radius: 8px;
      padding: 8px 10px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      overflow: hidden;
      user-select: none;
    }
    .ag-fp:hover {
      border-color: rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.03);
    }
    .ag-fp.ag-fp-filled {
      border-style: solid;
      border-color: rgba(163,230,53,0.28);
    }
    .ag-fp-thumb {
      width: 38px;
      height: 38px;
      border-radius: 6px;
      background: rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }
    .ag-fp-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .ag-fp-icon {
      color: rgba(255,255,255,0.25);
      font-size: 0.95rem;
    }
    .ag-fp-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .ag-fp-name {
      font-size: 0.74rem;
      font-weight: 600;
      color: #fff;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.2;
    }
    .ag-fp-placeholder { color: rgba(255,255,255,0.3); font-weight: 400; }
    .ag-fp-hint {
      font-size: 0.62rem;
      color: rgba(255,255,255,0.25);
      letter-spacing: 0.02em;
    }
    .ag-fp-action {
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--dm-accent, #a3e635);
      flex-shrink: 0;
      padding: 3px 9px;
      border: 1px solid rgba(163,230,53,0.3);
      border-radius: 5px;
      background: rgba(163,230,53,0.08);
      transition: background 0.15s;
      letter-spacing: 0.02em;
    }
    .ag-fp:hover .ag-fp-action {
      background: rgba(163,230,53,0.16);
    }

    .ag-color-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ag-color {
      width: 36px;
      height: 28px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      padding: 0;
      background: none;
    }
    .ag-color-val {
      font-size: 0.75rem;
      color: var(--dm-muted, #999);
      font-family: monospace;
    }

    .ag-req { color: #f87171; font-weight: 700; }

    .ag-dl-btn {
      margin-top: 16px;
      background: var(--dm-accent, #a3e635);
      color: #0a0f14;
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: center;
      transition: opacity 0.15s;
      width: 100%;
    }
    .ag-dl-btn:disabled { opacity: 0.38; cursor: not-allowed; }

    .ag-hint {
      font-size: 0.68rem;
      color: var(--dm-muted, #888);
      text-align: center;
      margin: 4px 0 0;
    }

    /* ── PREVIEW ── */
    .ag-preview-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    .ag-preview-lbl {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--dm-muted, #888);
    }
    .ag-preview-dim {
      font-weight: 400;
      opacity: 0.55;
      margin-left: 6px;
    }

    .ag-preview-scroll {
      overflow-x: auto;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px;
      display: inline-block;
      max-width: 100%;
    }

    @media (max-width: 768px) {
      .ag-wrap { flex-direction: column; }
      .ag-form { width: 100%; }
    }
  `],
})
export class AwardGeneratorComponent implements OnChanges {
  @Input() club!: Club;
  @ViewChild('preview') previewRef!: ElementRef<HTMLDivElement>;

  clubName    = '';
  awardTitle  = 'PLAQUE OF RECOGNITION';
  result      = 'Champion';
  category    = '';
  playerName  = '';
  location    = '';
  date        = '';
  primaryColor = '#0D3B1F';
  logoUrl: string | null = null;
  logoFileName = '';
  courtImage: string | null = null;
  courtFileName = '';

  isDownloading = false;

  readonly GOLD     = 'rgba(184,134,11,0.45)';
  readonly GOLD_DOT = 'rgba(184,134,11,0.6)';
  readonly DARK     = '#1a1a1a';
  readonly SERIF    = "'Cormorant Garamond', Georgia, serif";
  readonly SANS     = "'Montserrat', 'Helvetica Neue', Arial, sans-serif";

  get GREEN(): string     { return this.primaryColor || '#0D3B1F'; }
  get GREEN_MID(): string { return this.primaryColor || '#1a5c30'; }

  get isValid(): boolean {
    return !!(this.awardTitle?.trim() && this.result && this.category?.trim() && this.location?.trim() && this.date && this.courtImage);
  }

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['club'] && this.club) {
      this.clubName = this.club.name || '';
      this.location = this.club.location || '';
      if (this.club.logo) this.logoUrl = this.club.logo;
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  onLogoUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.logoFileName = file.name;
    const reader = new FileReader();
    reader.onload = e => { this.logoUrl = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  onCourtImageUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.courtFileName = file.name;
    const reader = new FileReader();
    reader.onload = e => { this.courtImage = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  async download(): Promise<void> {
    if (!this.isValid || this.isDownloading) return;
    this.isDownloading = true;
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(this.previewRef.nativeElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `${(this.clubName || 'award').replace(/\s+/g, '-').toLowerCase()}-award.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      this.isDownloading = false;
    }
  }

  // ── Plaque style objects (inline styles for html2canvas compatibility) ──

  get plaqueStyle(): Record<string, string> {
    return {
      position: 'relative',
      width: '600px',
      height: '800px',
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      boxSizing: 'border-box',
      padding: '50px 48px 42px',
      overflow: 'hidden',
      gap: '0',
    };
  }

  get outerBorderStyle(): Record<string, string> {
    return {
      position: 'absolute',
      top: '16px',
      left: '16px',
      right: '16px',
      bottom: '16px',
      border: `1px solid ${this.GOLD_DOT}`,
      borderRadius: '2px',
      pointerEvents: 'none',
    };
  }

  cornerStyle(v: 'top' | 'bottom', h: 'left' | 'right'): Record<string, string> {
    const s: Record<string, string> = {
      position: 'absolute',
      width: '20px',
      height: '20px',
      pointerEvents: 'none',
      borderTop:    v === 'top'    ? `2px solid ${this.GOLD_DOT}` : 'none',
      borderBottom: v === 'bottom' ? `2px solid ${this.GOLD_DOT}` : 'none',
      borderLeft:   h === 'left'  ? `2px solid ${this.GOLD_DOT}` : 'none',
      borderRight:  h === 'right' ? `2px solid ${this.GOLD_DOT}` : 'none',
    };
    s[v] = '10px';
    s[h] = '10px';
    return s;
  }

  get clubBannerStyle(): Record<string, string> {
    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      width: '100%',
      marginBottom: '18px',
      backgroundColor: '#ffffff',
      paddingTop: '12px',
      paddingBottom: '12px',
      boxSizing: 'border-box',
    };
  }

  get clubNameTextStyle(): Record<string, string> {
    return {
      fontFamily: this.SANS,
      fontSize: '19px',
      fontWeight: '700',
      letterSpacing: '0.18em',
      color: this.GREEN,
      textTransform: 'uppercase',
      textAlign: 'center',
      lineHeight: '1.3',
    };
  }

  get diamondDotStyle(): Record<string, string> {
    return {
      width: '6px',
      height: '6px',
      backgroundColor: this.GOLD_DOT,
      transform: 'rotate(45deg)',
      margin: '0 10px',
      flexShrink: '0',
    };
  }

  get resultStyle(): Record<string, string> {
    return {
      fontFamily: this.SERIF,
      fontSize: this.result === '2nd Runner-Up' ? '52px' : '82px',
      fontWeight: '700',
      letterSpacing: '0.05em',
      lineHeight: '1',
      textAlign: 'center',
      textTransform: 'uppercase',
      color: this.GREEN,
      textShadow: `0 3px 0 ${this.GREEN_MID}, 0 6px 16px rgba(13,59,31,0.18)`,
      marginTop: '22px',
      marginBottom: '28px',
    };
  }
}
