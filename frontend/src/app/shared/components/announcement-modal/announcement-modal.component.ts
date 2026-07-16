import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-announcement-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcement-modal.component.html',
  styleUrl: './announcement-modal.component.css',
})
export class AnnouncementModalComponent {
  @Input() title = '';
  @Input() html: SafeHtml = '';
  @Output() dismissed = new EventEmitter<void>();
}
