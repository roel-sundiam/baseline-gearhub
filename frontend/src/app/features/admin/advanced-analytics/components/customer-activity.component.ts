import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerActivity } from '../../../../core/services/club-analytics.service';

@Component({
  selector: 'app-customer-activity',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cust-card">
      <div>
        <span class="eyebrow">Members</span>
        <h3 class="cust-title">Customer activity</h3>
      </div>

      @if (!data || data.totalActiveCustomers === 0) {
        <div class="cust-empty">No customer activity for the selected range.</div>
      } @else {
        <div class="cust-tiles">
          <div class="cust-tile">
            <p class="tile-value">{{ data.totalActiveCustomers | number }}</p>
            <p class="tile-label">Active Customers</p>
          </div>
          <div class="cust-tile">
            <p class="tile-value">{{ data.newCustomers | number }}</p>
            <p class="tile-label">New</p>
          </div>
          <div class="cust-tile">
            <p class="tile-value">{{ data.returningCustomers | number }}</p>
            <p class="tile-label">Returning</p>
          </div>
          <div class="cust-tile">
            <p class="tile-value">{{ data.avgBookingsPerCustomer === null ? '—' : data.avgBookingsPerCustomer }}</p>
            <p class="tile-label">Avg Bookings / Customer</p>
          </div>
        </div>

        @if (data.topCustomers.length > 0) {
          <div class="top-customers">
            <p class="peak-subtitle">Top Customers</p>
            <table class="cust-table">
              <thead>
                <tr><th>Customer</th><th class="col-num">Bookings</th><th class="col-num">Revenue</th></tr>
              </thead>
              <tbody>
                @for (c of data.topCustomers; track c.email) {
                  <tr>
                    <td>
                      <div class="cust-name">{{ c.name }}</div>
                      <div class="cust-email">{{ c.email }}</div>
                    </td>
                    <td class="col-num">{{ c.bookings | number }}</td>
                    <td class="col-num">{{ c.revenue | currency: 'PHP' : 'symbol' : '1.0-2' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .cust-card {
      height: 100%; box-sizing: border-box;
      background: #fff;
      border: 1px solid #eadfce;
      border-radius: 18px;
      padding: 1.1rem 1.2rem;
      box-shadow: 0 8px 24px rgba(83,61,34,0.07);
      display: grid;
      gap: 1rem;
    }
    .eyebrow { color: #168c80; font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
    .cust-title { margin: 0.15rem 0 0; font-size: 1rem; color: #302a23; }
    .cust-empty { color: #958979; font-size: 0.85rem; padding: 1rem 0; text-align: center; }

    .cust-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.7rem; }
    @media (max-width: 700px) { .cust-tiles { grid-template-columns: repeat(2, 1fr); } }
    .cust-tile { background: #f5faf8; border: 1px solid #dceee9; border-radius: 12px; padding: 0.7rem; text-align: center; }
    .tile-value { margin: 0; font-size: 1.3rem; font-weight: 800; color: #168c80; }
    .tile-label { margin: 0.2rem 0 0; font-size: 0.67rem; color: #7c817b; }

    .peak-subtitle { margin: 0 0 0.5rem; font-size: 0.68rem; color: #8f8273; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
    .cust-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .cust-table th { text-align: left; padding: 0.45rem 0.5rem; color: #928575; font-weight: 700; font-size: 0.66rem; text-transform: uppercase; border-bottom: 1px solid #eadfce; }
    .cust-table td { padding: 0.48rem 0.5rem; color: #4c443b; border-bottom: 1px solid #f0e8dc; }
    .col-num { text-align: right; }
    .cust-name { color: #352f28; font-weight: 700; }
    .cust-email { color: #918577; font-size: 0.7rem; }
    @media (max-width: 520px) { .cust-card { padding: 1rem 0.9rem; } }

    /* Dark-green member analytics */
    .cust-card { background: #1b3028; border-color: rgba(255,255,255,0.08); box-shadow: 0 8px 24px rgba(0,0,0,0.22); }
    .eyebrow { color: #2dd4bf; }
    .cust-title { color: #fff; }
    .cust-empty, .peak-subtitle { color: rgba(255,255,255,0.45); }
    .cust-tile { background: rgba(45,212,191,0.07); border-color: rgba(45,212,191,0.12); }
    .tile-value { color: #2dd4bf; }
    .tile-label { color: rgba(255,255,255,0.45); }
    .cust-table th { color: rgba(255,255,255,0.42); border-color: rgba(255,255,255,0.09); }
    .cust-table td { color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.06); }
    .cust-name { color: #fff; }
    .cust-email { color: rgba(255,255,255,0.42); }
  `],
})
export class CustomerActivityComponent {
  @Input() data: CustomerActivity | null = null;
}
