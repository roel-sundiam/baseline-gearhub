import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TrendSeriesPoint {
  period: string;
  value: number;
}

interface ChartPoint extends TrendSeriesPoint {
  index: number;
  x: number;
  y: number;
}

@Component({
  selector: 'app-trend-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="chart-card" [class.chart-card--teal]="tone === 'teal'">
      <header class="chart-header">
        <div class="chart-heading">
          <span class="chart-icon"><i class="fas {{ icon }}"></i></span>
          <div>
            <h3 class="chart-title">{{ title }}</h3>
            <p class="chart-subtitle">{{ subtitle }}</p>
          </div>
        </div>

        @if (showGranularityToggle) {
          <div class="granularity-toggle" aria-label="Chart interval">
            @for (g of granularities; track g) {
              <button
                type="button"
                class="g-btn"
                [class.g-btn--active]="granularity === g"
                (click)="granularityChange.emit(g)"
              >{{ g | titlecase }}</button>
            }
          </div>
        }
      </header>

      @if (!series.length) {
        <div class="chart-empty">
          <i class="fas fa-chart-line"></i>
          <span>No data for the selected range.</span>
        </div>
      } @else {
        <div class="chart-stats">
          <div class="chart-stat">
            <span>Total</span>
            <strong>{{ formatValue(summary().total) }}</strong>
          </div>
          <div class="chart-stat">
            <span>Average</span>
            <strong>{{ formatValue(summary().average) }}</strong>
          </div>
          <div class="chart-stat chart-stat--peak">
            <span>Peak · {{ shortLabel(summary().peak.period) }}</span>
            <strong>{{ formatValue(summary().peak.value) }}</strong>
          </div>
        </div>

        <div class="chart-plot">
          <svg
            class="trend-svg"
            [attr.viewBox]="'0 0 ' + width + ' ' + height"
            role="img"
            [attr.aria-label]="title + ' trend chart'"
            (mouseleave)="activePoint.set(null)"
          >
            @for (tick of yTicks(); track tick.value) {
              <line
                class="grid-line"
                [attr.x1]="plotLeft"
                [attr.x2]="width - plotRight"
                [attr.y1]="tick.y"
                [attr.y2]="tick.y"
              />
              <text class="axis-label axis-label--y" [attr.x]="plotLeft - 10" [attr.y]="tick.y + 4">
                {{ compactValue(tick.value) }}
              </text>
            }

            <path class="area-path" [attr.d]="areaPath()" />
            <path class="line-path" [attr.d]="linePath()" />

            @for (label of xLabels(); track label.index) {
              <text class="axis-label axis-label--x" [attr.x]="label.x" [attr.y]="height - 12">
                {{ shortLabel(label.period) }}
              </text>
            }

            @if (activePoint(); as active) {
              <line
                class="hover-line"
                [attr.x1]="active.x"
                [attr.x2]="active.x"
                [attr.y1]="plotTop"
                [attr.y2]="height - plotBottom"
              />
            }

            @for (point of chartPoints(); track point.index) {
              <circle
                class="data-hit"
                [attr.cx]="point.x"
                [attr.cy]="point.y"
                r="12"
                tabindex="0"
                (mouseenter)="activePoint.set(point)"
                (focus)="activePoint.set(point)"
                (blur)="activePoint.set(null)"
              >
                <title>{{ longLabel(point.period) }}: {{ formatValue(point.value) }}</title>
              </circle>
            }

            @if (activePoint(); as active) {
              <circle class="active-dot-halo" [attr.cx]="active.x" [attr.cy]="active.y" r="8" />
              <circle class="active-dot" [attr.cx]="active.x" [attr.cy]="active.y" r="4" />
            }
          </svg>

          @if (activePoint(); as active) {
            <div
              class="chart-tooltip"
              [style.left.%]="tooltipLeft(active.x)"
              [class.chart-tooltip--right]="active.x > width * 0.68"
              [style.top.%]="tooltipTop(active.y)"
            >
              <span>{{ longLabel(active.period) }}</span>
              <strong>{{ formatValue(active.value) }}</strong>
            </div>
          }
        </div>
      }
    </article>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .chart-card {
      --chart-accent: #b88942;
      --chart-accent-rgb: 184, 137, 66;
      background: #fff;
      border: 1px solid #eadfce;
      border-radius: 18px;
      padding: 1.15rem 1.2rem 1rem;
      box-shadow: 0 8px 24px rgba(83, 61, 34, 0.07);
      min-width: 0;
    }
    .chart-card--teal { --chart-accent: #168c80; --chart-accent-rgb: 22, 140, 128; }
    .chart-header { display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; flex-wrap: wrap; }
    .chart-heading { display: flex; align-items: center; gap: 0.7rem; }
    .chart-icon {
      width: 38px; height: 38px; border-radius: 11px;
      display: grid; place-items: center;
      color: var(--chart-accent); background: rgba(var(--chart-accent-rgb), 0.11);
    }
    .chart-title { margin: 0; color: #29241e; font-size: 1rem; letter-spacing: -0.01em; }
    .chart-subtitle { margin: 0.18rem 0 0; color: #887b6a; font-size: 0.76rem; }
    .granularity-toggle { display: inline-flex; padding: 3px; gap: 2px; background: #f5efe6; border-radius: 10px; }
    .g-btn {
      border: 0; background: transparent; color: #786d5f; cursor: pointer;
      padding: 0.38rem 0.65rem; border-radius: 8px; font-family: inherit; font-size: 0.7rem; font-weight: 700;
      transition: background 0.16s, color 0.16s, box-shadow 0.16s;
    }
    .g-btn:hover { color: #3f382f; }
    .g-btn--active { background: #fff; color: var(--chart-accent); box-shadow: 0 2px 7px rgba(74, 54, 31, 0.12); }
    .chart-stats { display: flex; align-items: center; gap: 1.6rem; margin: 1rem 0 0.25rem 3.5rem; }
    .chart-stat { display: grid; gap: 0.12rem; }
    .chart-stat span { color: #958777; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .chart-stat strong { color: #332d26; font-size: 0.92rem; }
    .chart-stat--peak { padding-left: 1.6rem; border-left: 1px solid #eee5d8; }
    .chart-stat--peak strong { color: var(--chart-accent); }
    .chart-plot { position: relative; width: 100%; min-height: 240px; }
    .trend-svg { display: block; width: 100%; height: auto; min-height: 230px; overflow: visible; }
    .grid-line { stroke: #eee8df; stroke-width: 1; stroke-dasharray: 3 5; }
    .axis-label { fill: #9b9082; font-size: 10px; font-family: inherit; }
    .axis-label--y { text-anchor: end; }
    .axis-label--x { text-anchor: middle; }
    .area-path { fill: var(--chart-accent); opacity: 0.11; }
    .line-path { fill: none; stroke: var(--chart-accent); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .data-hit { fill: transparent; cursor: crosshair; outline: none; }
    .hover-line { stroke: rgba(var(--chart-accent-rgb), 0.35); stroke-width: 1; stroke-dasharray: 3 3; }
    .active-dot-halo { fill: rgba(var(--chart-accent-rgb), 0.18); }
    .active-dot { fill: #fff; stroke: var(--chart-accent); stroke-width: 3; }
    .chart-tooltip {
      position: absolute; z-index: 3; pointer-events: none; transform: translate(10px, -100%);
      display: grid; gap: 0.15rem; min-width: 100px; padding: 0.55rem 0.65rem;
      border-radius: 10px; background: #2d2924; color: #fff; box-shadow: 0 7px 20px rgba(44, 35, 24, 0.24);
    }
    .chart-tooltip--right { transform: translate(calc(-100% - 10px), -100%); }
    .chart-tooltip span { font-size: 0.66rem; color: rgba(255,255,255,0.65); }
    .chart-tooltip strong { font-size: 0.83rem; }
    .chart-empty { min-height: 235px; display: grid; place-items: center; align-content: center; gap: 0.6rem; color: #9a8e7e; font-size: 0.82rem; }
    .chart-empty i { font-size: 1.4rem; color: #cbbda9; }

    @media (max-width: 640px) {
      .chart-card { padding: 1rem 0.85rem 0.8rem; border-radius: 15px; }
      .chart-stats { margin-left: 0; gap: 1rem; justify-content: space-between; }
      .chart-stat--peak { padding-left: 1rem; }
      .chart-stat strong { font-size: 0.8rem; }
      .chart-plot { min-height: 210px; }
      .trend-svg { min-height: 205px; }
    }

    /* Dark-green graph palette */
    .chart-card {
      --chart-accent: #a3e635;
      --chart-accent-rgb: 163, 230, 53;
      background: #1b3028;
      border-color: rgba(255,255,255,0.08);
      box-shadow: 0 8px 24px rgba(0,0,0,0.22);
    }
    .chart-card--teal { --chart-accent: #2dd4bf; --chart-accent-rgb: 45, 212, 191; }
    .chart-icon { background: rgba(var(--chart-accent-rgb), 0.12); }
    .chart-title { color: #fff; }
    .chart-subtitle { color: rgba(255,255,255,0.46); }
    .granularity-toggle { background: #13261d; }
    .g-btn { color: rgba(255,255,255,0.48); }
    .g-btn:hover { color: #fff; }
    .g-btn--active { color: var(--chart-accent); background: #264236; box-shadow: 0 2px 8px rgba(0,0,0,0.24); }
    .chart-stat span { color: rgba(255,255,255,0.4); }
    .chart-stat strong { color: #fff; }
    .chart-stat--peak { border-color: rgba(255,255,255,0.08); }
    .chart-stat--peak strong { color: var(--chart-accent); }
    .grid-line { stroke: rgba(200,240,218,0.11); }
    .axis-label { fill: rgba(255,255,255,0.42); }
    .area-path { opacity: 0.09; }
    .line-path { filter: drop-shadow(0 2px 3px rgba(var(--chart-accent-rgb), 0.14)); }
    .active-dot { fill: #1b3028; }
    .chart-tooltip { background: #0f2017; border: 1px solid rgba(var(--chart-accent-rgb),0.18); box-shadow: 0 7px 20px rgba(0,0,0,0.35); }
    .chart-empty { color: rgba(255,255,255,0.45); }
    .chart-empty i { color: rgba(var(--chart-accent-rgb),0.45); }
  `],
})
export class TrendChartComponent {
  @Input() title = '';
  @Input() subtitle = 'Performance across the selected period';
  @Input() icon = 'fa-chart-line';
  @Input() tone: 'gold' | 'teal' = 'gold';
  @Input() set data(value: TrendSeriesPoint[]) {
    this._series.set(value ?? []);
    this.activePoint.set(null);
  }
  @Input() valueFormat: 'number' | 'currency' = 'number';
  @Input() granularity: 'day' | 'week' | 'month' = 'day';
  @Input() granularities: ('day' | 'week' | 'month')[] = ['day', 'week', 'month'];
  @Input() showGranularityToggle = true;
  @Output() granularityChange = new EventEmitter<'day' | 'week' | 'month'>();

  readonly width = 760;
  readonly height = 280;
  readonly plotLeft = 64;
  readonly plotRight = 18;
  readonly plotTop = 18;
  readonly plotBottom = 44;

  private _series = signal<TrendSeriesPoint[]>([]);
  activePoint = signal<ChartPoint | null>(null);

  get series(): TrendSeriesPoint[] {
    return this._series();
  }

  private yMaximum = computed(() => {
    const maximum = Math.max(0, ...this._series().map((point) => point.value));
    if (maximum === 0) return 1;
    const rawStep = maximum / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
    return niceNormalized * magnitude * 4;
  });

  chartPoints = computed<ChartPoint[]>(() => {
    const rows = this._series();
    const plotWidth = this.width - this.plotLeft - this.plotRight;
    const plotHeight = this.height - this.plotTop - this.plotBottom;
    return rows.map((point, index) => ({
      ...point,
      index,
      x: rows.length === 1 ? this.plotLeft + plotWidth / 2 : this.plotLeft + (index / (rows.length - 1)) * plotWidth,
      y: this.plotTop + plotHeight - (point.value / this.yMaximum()) * plotHeight,
    }));
  });

  linePath = computed(() => this.chartPoints().map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '));

  areaPath = computed(() => {
    const points = this.chartPoints();
    if (!points.length) return '';
    const baseline = this.height - this.plotBottom;
    return `${this.linePath()} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
  });

  yTicks = computed(() => {
    const maximum = this.yMaximum();
    const plotHeight = this.height - this.plotTop - this.plotBottom;
    return Array.from({ length: 5 }, (_, index) => {
      const value = maximum - (maximum / 4) * index;
      return { value, y: this.plotTop + (plotHeight / 4) * index };
    });
  });

  xLabels = computed(() => {
    const points = this.chartPoints();
    if (points.length <= 6) return points;
    const step = Math.ceil((points.length - 1) / 5);
    const selected = points.filter((_, index) => index % step === 0);
    const last = points[points.length - 1];
    if (selected[selected.length - 1]?.index !== last.index) selected.push(last);
    return selected;
  });

  summary = computed(() => {
    const rows = this._series();
    const total = rows.reduce((sum, point) => sum + point.value, 0);
    const peak = rows.reduce((best, point) => point.value > best.value ? point : best, rows[0]);
    return { total, average: rows.length ? total / rows.length : 0, peak: peak ?? { period: '', value: 0 } };
  });

  tooltipLeft(x: number): number {
    return (x / this.width) * 100;
  }

  tooltipTop(y: number): number {
    return Math.max(14, (y / this.height) * 100);
  }

  formatValue(value: number): string {
    return this.valueFormat === 'currency'
      ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value)
      : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
  }

  compactValue(value: number): string {
    const prefix = this.valueFormat === 'currency' ? '₱' : '';
    return prefix + new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }

  shortLabel(period: string): string {
    const dayMatch = period.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dayMatch) {
      const date = new Date(+dayMatch[1], +dayMatch[2] - 1, +dayMatch[3]);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const weekMatch = period.match(/^(\d{4})-W(\d{2})$/);
    if (weekMatch) return `W${weekMatch[2]}`;
    const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) {
      const date = new Date(+monthMatch[1], +monthMatch[2] - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
    return period;
  }

  longLabel(period: string): string {
    const dayMatch = period.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dayMatch) {
      const date = new Date(+dayMatch[1], +dayMatch[2] - 1, +dayMatch[3]);
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    return this.shortLabel(period);
  }
}
