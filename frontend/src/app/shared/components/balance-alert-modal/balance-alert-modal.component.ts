import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-balance-alert-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './balance-alert-modal.component.html',
  styleUrl: './balance-alert-modal.component.css',
})
export class BalanceAlertModalComponent {
  @Input() balance = 0;
  @Output() dismissed = new EventEmitter<void>();

  private router = inject(Router);

  goToPayment() {
    this.dismissed.emit();
    this.router.navigate(['/admin/finance'], { state: { openPayForm: true, payAmount: this.balance } });
  }
}
