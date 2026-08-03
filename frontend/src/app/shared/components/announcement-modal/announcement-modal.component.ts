import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-announcement-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './announcement-modal.component.html',
  styleUrl: './announcement-modal.component.css',
})
export class AnnouncementModalComponent {
  @Input() title = '';
  @Input() html: SafeHtml = '';
  @Input() confirming = false;
  @Output() confirmed = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  agreed = false;
}
