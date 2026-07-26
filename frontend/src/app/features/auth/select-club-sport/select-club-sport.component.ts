import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-select-club-sport',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="sport-page">
      <header class="topbar">
        <button class="back-button" (click)="goBack()" type="button" aria-label="Go back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span>Back</span>
        </button>

        <a routerLink="/" class="brand" aria-label="CourtGo home">
          <img src="/CourtGo.png" alt="CourtGo" />
        </a>

        <a routerLink="/player-login" class="sign-in">Sign in</a>
      </header>

      <section class="sport-content">
        <div class="hero-copy">
          <div class="eyebrow">
            <span class="eyebrow-mark"></span>
            Club registration
          </div>
          <h1>What do you play?</h1>
          <p>Choose your club's primary sport. We'll shape the booking experience around how your game is played.</p>
        </div>

        <div class="sport-grid">
          @for (sport of sports; track sport.value) {
            <a
              class="sport-card"
              [routerLink]="'/register-club/' + sport.value"
              [attr.aria-label]="'Register a ' + sport.label + ' club'"
            >
              <img
                class="sport-image"
                [src]="sport.image"
                [alt]="sport.alt"
                loading="eager"
              />
              <span class="sport-shade"></span>
              <span class="sport-index">{{ sport.index }}</span>
              <span class="sport-details">
                <span class="sport-label">{{ sport.label }}</span>
                <span class="sport-description">{{ sport.description }}</span>
              </span>
              <span class="sport-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </a>
          }
        </div>

        <footer class="page-note">
          <span class="note-icon" aria-hidden="true">i</span>
          You can add more sports and facilities after registration.
        </footer>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        color: #f6f9f4;
        background: #07110b;
      }

      .sport-page {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        background:
          radial-gradient(circle at 10% 0%, rgba(154, 218, 62, 0.1), transparent 32rem),
          radial-gradient(circle at 92% 85%, rgba(48, 117, 67, 0.12), transparent 30rem),
          #07110b;
      }

      .sport-page::before {
        position: fixed;
        inset: 0;
        pointer-events: none;
        content: '';
        opacity: 0.22;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
        background-size: 72px 72px;
        mask-image: linear-gradient(to bottom, black, transparent 80%);
      }

      .topbar {
        position: relative;
        z-index: 2;
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        width: min(100% - 3rem, 1240px);
        height: 88px;
        margin: 0 auto;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .brand {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .brand img {
        display: block;
        width: auto;
        height: 32px;
      }

      .back-button,
      .sign-in {
        color: rgba(255, 255, 255, 0.62);
        font: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.01em;
      }

      .back-button {
        display: inline-flex;
        align-items: center;
        justify-self: start;
        gap: 0.35rem;
        padding: 0.6rem 0.7rem 0.6rem 0.35rem;
        border: 0;
        background: transparent;
        cursor: pointer;
      }

      .back-button svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
      }

      .sign-in {
        justify-self: end;
        padding: 0.65rem 1rem;
        border: 1px solid rgba(255, 255, 255, 0.13);
        border-radius: 999px;
        text-decoration: none;
      }

      .back-button:hover,
      .sign-in:hover {
        color: #fff;
      }

      .sign-in:hover {
        border-color: rgba(163, 230, 53, 0.5);
        background: rgba(163, 230, 53, 0.06);
      }

      .sport-content {
        position: relative;
        z-index: 1;
        width: min(100% - 3rem, 1160px);
        margin: 0 auto;
        padding: 4.6rem 0 2.25rem;
      }

      .hero-copy {
        max-width: 680px;
        margin-bottom: 2.75rem;
      }

      .eyebrow {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        margin-bottom: 1.05rem;
        color: #a3e635;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .eyebrow-mark {
        width: 22px;
        height: 2px;
        border-radius: 10px;
        background: #a3e635;
        box-shadow: 0 0 14px rgba(163, 230, 53, 0.55);
      }

      h1 {
        margin: 0;
        color: #f8faf7;
        font-size: clamp(2.5rem, 5vw, 4.7rem);
        font-weight: 800;
        letter-spacing: -0.055em;
        line-height: 0.98;
      }

      .hero-copy p {
        max-width: 590px;
        margin: 1.2rem 0 0;
        color: rgba(236, 244, 232, 0.52);
        font-size: clamp(0.92rem, 1.5vw, 1.05rem);
        line-height: 1.65;
      }

      .sport-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .sport-card {
        position: relative;
        display: block;
        min-height: 235px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 18px;
        isolation: isolate;
        text-decoration: none;
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
        transition:
          transform 220ms ease,
          border-color 220ms ease,
          box-shadow 220ms ease;
      }

      .sport-image,
      .sport-shade {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .sport-image {
        z-index: -2;
        object-fit: cover;
        filter: saturate(0.82) contrast(1.05);
        transition: transform 600ms cubic-bezier(0.2, 0.65, 0.3, 1), filter 300ms ease;
      }

      .sport-shade {
        z-index: -1;
        background:
          linear-gradient(180deg, rgba(4, 10, 6, 0.04) 18%, rgba(4, 10, 6, 0.9) 100%),
          linear-gradient(90deg, rgba(4, 10, 6, 0.34), transparent 65%);
      }

      .sport-index {
        position: absolute;
        top: 1rem;
        left: 1rem;
        display: grid;
        width: 28px;
        height: 28px;
        place-items: center;
        border: 1px solid rgba(255, 255, 255, 0.26);
        border-radius: 50%;
        color: rgba(255, 255, 255, 0.82);
        background: rgba(4, 10, 6, 0.34);
        backdrop-filter: blur(8px);
        font-size: 0.67rem;
        font-weight: 800;
      }

      .sport-details {
        position: absolute;
        right: 4.4rem;
        bottom: 1.25rem;
        left: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }

      .sport-label {
        color: #fff;
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.025em;
      }

      .sport-description {
        color: rgba(255, 255, 255, 0.56);
        font-size: 0.76rem;
        font-weight: 600;
      }

      .sport-arrow {
        position: absolute;
        right: 1.2rem;
        bottom: 1.2rem;
        display: grid;
        width: 39px;
        height: 39px;
        place-items: center;
        border-radius: 50%;
        color: #10200f;
        background: #a3e635;
        box-shadow: 0 6px 20px rgba(102, 160, 24, 0.32);
        transition: transform 220ms ease, background 220ms ease;
      }

      .sport-arrow svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.8;
      }

      .sport-card:hover {
        z-index: 2;
        border-color: rgba(163, 230, 53, 0.55);
        box-shadow: 0 22px 50px rgba(0, 0, 0, 0.36), 0 0 0 1px rgba(163, 230, 53, 0.08);
        transform: translateY(-5px);
      }

      .sport-card:hover .sport-image {
        filter: saturate(1) contrast(1.04);
        transform: scale(1.055);
      }

      .sport-card:hover .sport-arrow {
        background: #b7f34e;
        transform: translateX(3px);
      }

      .sport-card:focus-visible,
      .back-button:focus-visible,
      .sign-in:focus-visible {
        outline: 3px solid rgba(163, 230, 53, 0.85);
        outline-offset: 3px;
      }

      .page-note {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.55rem;
        padding-top: 1.8rem;
        color: rgba(255, 255, 255, 0.35);
        font-size: 0.75rem;
      }

      .note-icon {
        display: grid;
        width: 17px;
        height: 17px;
        place-items: center;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        font-size: 0.62rem;
        font-weight: 800;
      }

      @media (max-width: 900px) {
        .sport-content {
          padding-top: 3.5rem;
        }

        .sport-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .sport-card {
          min-height: 225px;
        }
      }

      @media (max-width: 600px) {
        .topbar {
          width: min(100% - 2rem, 1240px);
          height: 72px;
        }

        .brand img {
          height: 25px;
        }

        .sign-in {
          padding: 0.5rem 0.75rem;
        }

        .back-button span {
          display: none;
        }

        .sport-content {
          width: min(100% - 2rem, 1160px);
          padding: 2.9rem 0 1.5rem;
        }

        .hero-copy {
          margin-bottom: 2rem;
        }

        h1 {
          font-size: clamp(2.5rem, 14vw, 3.6rem);
        }

        .hero-copy p {
          margin-top: 1rem;
          font-size: 0.88rem;
        }

        .sport-grid {
          gap: 0.7rem;
        }

        .sport-card {
          min-height: 195px;
          border-radius: 14px;
        }

        .sport-index {
          top: 0.75rem;
          left: 0.75rem;
        }

        .sport-details {
          right: 1rem;
          bottom: 1rem;
          left: 1rem;
        }

        .sport-label {
          font-size: 1.05rem;
        }

        .sport-description,
        .sport-arrow {
          display: none;
        }
      }

      @media (max-width: 390px) {
        .sport-card {
          min-height: 170px;
        }

        .sport-label {
          font-size: 0.96rem;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .sport-card,
        .sport-image,
        .sport-arrow {
          transition: none;
        }
      }
    `,
  ],
})
export class SelectClubSportComponent {
  private router = inject(Router);
  private loc = inject(Location);

  readonly sports = [
    {
      value: 'tennis',
      label: 'Tennis',
      description: 'Classic court reservations',
      index: '01',
      image: '/images/sports/tennis.jpg',
      alt: 'Tennis racket and balls resting on a court',
    },
    {
      value: 'pickleball',
      label: 'Pickleball',
      description: 'Social play and quick rotations',
      index: '02',
      image: '/images/sports/pickleball.jpg',
      alt: 'Pickleball paddle and ball resting on a court',
    },
    {
      value: 'badminton',
      label: 'Badminton',
      description: 'Fast rallies, seamless booking',
      index: '03',
      image: '/images/sports/badminton.jpg',
      alt: 'Badminton racket surrounded by shuttlecocks',
    },
    {
      value: 'squash',
      label: 'Squash',
      description: 'Indoor courts, simple schedules',
      index: '04',
      image: '/images/sports/squash.jpg',
      alt: 'Squash racket and ball on a wooden court',
    },
    {
      value: 'table_tennis',
      label: 'Table Tennis',
      description: 'Matches, tables and club play',
      index: '05',
      image: '/images/sports/table-tennis.jpg',
      alt: 'Table tennis paddle and ball on a blue table',
    },
    {
      value: 'padel',
      label: 'Padel',
      description: 'Modern courts, effortless play',
      index: '06',
      image: '/images/sports/padel.jpg',
      alt: 'Padel racket and ball resting on a blue court',
    },
  ];

  goBack() {
    if ((history.state?.navigationId ?? 1) > 1) {
      this.loc.back();
    } else {
      this.router.navigate(['/book']);
    }
  }
}
