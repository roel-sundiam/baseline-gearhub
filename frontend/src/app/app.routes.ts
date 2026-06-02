import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'login',
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
    path: 'admin',
    canActivate: [authGuard, adminGuard],
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
        path: 'open-play',
        loadComponent: () =>
          import('./features/admin/open-play/open-play.component').then(
            (m) => m.OpenPlayComponent,
          ),
      },
    ],
  },
  {
    path: 'player',
    canActivate: [authGuard],
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
        path: 'reservations',
        loadComponent: () =>
          import('./features/player/my-reservations/my-reservations.component').then(
            (m) => m.MyReservationsComponent,
          ),
      },
      {
        path: 'payment-approvals',
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
  { path: '**', redirectTo: '', pathMatch: 'full' },
];
