import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { termsGuard } from './core/guards/terms.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [() => {
      if (window.location.hostname === 'app.courtgo.club') {
        return inject(Router).createUrlTree(['/player-login']);
      }
      return true;
    }],
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'features',
    loadComponent: () =>
      import('./features/landing/features-showcase.component').then((m) => m.FeaturesShowcaseComponent),
  },
  {
    path: 'player-login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'register-club',
    loadComponent: () =>
      import('./features/auth/register-club/register-club.component').then((m) => m.RegisterClubComponent),
  },
  {
    path: 'admin/accept-terms',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/auth/accept-terms/accept-terms.component').then(
        (m) => m.AcceptTermsComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard, termsGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then(
            (m) => m.AdminDashboardComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/users/users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'rates',
        loadComponent: () =>
          import('./features/admin/rates/rates.component').then((m) => m.AdminRatesComponent),
      },
      {
        path: 'sessions',
        loadComponent: () =>
          import('./features/admin/sessions/sessions.component').then(
            (m) => m.AdminSessionsComponent,
          ),
      },
      {
        path: 'sessions/new',
        loadComponent: () =>
          import('./features/admin/sessions/new-session.component').then(
            (m) => m.NewSessionComponent,
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./features/admin/analytics/analytics.component').then(
            (m) => m.AnalyticsComponent,
          ),
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./features/admin/admin-reservations/admin-reservations.component').then(
            (m) => m.AdminReservationsComponent,
          ),
      },
      {
        path: 'reservations-report',
        loadComponent: () =>
          import('./features/admin/reservations-report/reservations-report.component').then(
            (m) => m.ReservationsReportComponent,
          ),
      },
      {
        path: 'payment-approvals',
        loadComponent: () =>
          import('./features/admin/payment-approvals/payment-approvals.component').then(
            (m) => m.PaymentApprovalsComponent,
          ),
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./features/admin/finance/finance.component').then(
            (m) => m.FinanceComponent,
          ),
      },
      {
        path: 'tournaments',
        loadComponent: () =>
          import('./features/admin/tournaments/tournaments.component').then(
            (m) => m.AdminTournamentsComponent,
          ),
      },
      {
        path: 'tournaments/:id',
        loadComponent: () =>
          import('./features/admin/tournaments/tournament-detail.component').then(
            (m) => m.AdminTournamentDetailComponent,
          ),
      },
      {
        path: 'clubs',
        loadComponent: () =>
          import('./features/admin/clubs/clubs.component').then((m) => m.AdminClubsComponent),
      },
      {
        path: 'clubs/new',
        loadComponent: () =>
          import('./features/admin/clubs/club-form.component').then((m) => m.ClubFormComponent),
      },
      {
        path: 'clubs/:id/edit',
        loadComponent: () =>
          import('./features/admin/clubs/club-form.component').then((m) => m.ClubFormComponent),
      },
      {
        path: 'admins',
        loadComponent: () =>
          import('./features/admin/clubs/manage-admins.component').then((m) => m.ManageAdminsComponent),
      },
      {
        path: 'news',
        loadComponent: () =>
          import('./features/admin/news/admin-news.component').then((m) => m.AdminNewsComponent),
      },
      {
        path: 'inquiries',
        loadComponent: () =>
          import('./features/admin/inquiries/inquiries.component').then((m) => m.InquiriesComponent),
      },
      {
        path: 'dev-finance',
        loadComponent: () =>
          import('./features/admin/dev-finance/dev-finance.component').then(
            (m) => m.DevFinanceComponent,
          ),
      },
      {
        path: 'convenience-fee-report',
        loadComponent: () =>
          import('./features/admin/convenience-fee-report/convenience-fee-report.component').then(
            (m) => m.ConvenienceFeeReportComponent,
          ),
      },
      {
        path: 'club-calendar',
        loadComponent: () =>
          import('./features/admin/club-calendar/club-calendar.component').then(
            (m) => m.ClubCalendarComponent,
          ),
      },
      {
        path: 'ledger',
        loadComponent: () =>
          import('./features/admin/ledger/ledger.component').then(
            (m) => m.LedgerComponent,
          ),
      },
      {
        path: 'open-play',
        loadComponent: () =>
          import('./features/admin/open-play/open-play.component').then(
            (m) => m.OpenPlayComponent,
          ),
      },
      {
        path: 'per-game',
        loadComponent: () =>
          import('./features/admin/per-game/per-game.component').then(
            (m) => m.AdminPerGameComponent,
          ),
      },
      {
        path: 'hosted-play',
        loadComponent: () =>
          import('./features/admin/hosted-play/hosted-play.component').then(
            (m) => m.AdminHostedPlayComponent,
          ),
      },
      {
        path: 'hosted-play/:id/queue',
        loadComponent: () =>
          import('./features/admin/hosted-play/queue/hosted-play-queue.component').then(
            (m) => m.AdminHostedPlayQueueComponent,
          ),
      },
      {
        path: 'award-generator',
        loadComponent: () =>
          import('./features/admin/clubs/award-generator-page.component').then(
            (m) => m.AwardGeneratorPageComponent,
          ),
      },
      {
        path: 'terms-editor',
        loadComponent: () =>
          import('./features/admin/terms-editor/terms-editor.component').then(
            (m) => m.TermsEditorComponent,
          ),
      },
    ],
  },
  {
    path: 'player',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/player/player-shell.component').then(
        (m) => m.PlayerShellComponent,
      ),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/player/dashboard/player-dashboard.component').then(
            (m) => m.PlayerDashboardComponent,
          ),
      },
      {
        path: 'directory',
        loadComponent: () =>
          import('./features/player/member-directory/member-directory.component').then(
            (m) => m.MemberDirectoryComponent,
          ),
      },
      {
        path: 'profile/edit',
        loadComponent: () =>
          import('./features/player/profile/profile-edit.component').then(
            (m) => m.ProfileEditComponent,
          ),
      },
      {
        path: 'reserve',
        loadComponent: () =>
          import('./features/player/reserve-court/reserve-court.component').then(
            (m) => m.ReserveCourtComponent,
          ),
      },
      {
        path: 'per-game',
        loadComponent: () =>
          import('./features/player/per-game/per-game.component').then(
            (m) => m.PlayerPerGameComponent,
          ),
      },
      {
        path: 'hosted-play',
        loadComponent: () =>
          import('./features/player/hosted-play/hosted-play.component').then(
            (m) => m.PlayerHostedPlayComponent,
          ),
      },
      {
        path: 'hosted-play/:id/live',
        loadComponent: () =>
          import('./features/player/hosted-play/live-board.component').then(
            (m) => m.PlayerHostedPlayLiveBoardComponent,
          ),
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./features/player/my-reservations/my-reservations.component').then(
            (m) => m.MyReservationsComponent,
          ),
      },
      {
        path: 'payment-approvals',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/player/payment-approvals/player-payment-approvals.component').then(
            (m) => m.PlayerPaymentApprovalsComponent,
          ),
      },
      {
        path: 'tournaments',
        loadComponent: () =>
          import('./features/player/tournaments/tournaments.component').then(
            (m) => m.PlayerTournamentsComponent,
          ),
      },
      {
        path: 'tournaments/:id',
        loadComponent: () =>
          import('./features/player/tournaments/tournament-detail.component').then(
            (m) => m.PlayerTournamentDetailComponent,
          ),
      },
      {
        path: 'rules',
        loadComponent: () =>
          import('./features/player/rules/rules.component').then(
            (m) => m.PlayerRulesComponent,
          ),
      },
      {
        path: 'open-play',
        loadComponent: () =>
          import('./features/player/open-play/player-open-play.component').then(
            (m) => m.PlayerOpenPlayComponent,
          ),
      },
      {
        path: 'open-play/:id',
        loadComponent: () =>
          import('./features/player/open-play/player-open-play-detail.component').then(
            (m) => m.PlayerOpenPlayDetailComponent,
          ),
      },
    ],
  },
  {
    path: 'payments',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/player/payments/payments.component').then(
        (m) => m.PlayerPaymentsComponent,
      ),
  },
  {
    path: 'book',
    loadComponent: () =>
      import('./features/guest-booking/club-picker/club-picker.component').then(
        (m) => m.ClubPickerComponent
      ),
  },
  {
    path: 'book/:clubId/reserve',
    loadComponent: () =>
      import('./features/guest-booking/guest-reserve/guest-reserve.component').then(
        (m) => m.GuestReserveComponent,
      ),
  },
  {
    path: 'book/:clubId',
    loadComponent: () =>
      import('./features/guest-booking/guest-book/guest-book.component').then(
        (m) => m.GuestBookComponent,
      ),
  },
  {
    path: 'review/:clubId',
    loadComponent: () =>
      import('./features/review-form/review-form.component').then((m) => m.ReviewFormComponent),
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
