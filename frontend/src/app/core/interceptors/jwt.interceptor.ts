import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  if (token && !req.url.includes('/api/public/')) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 403 && err.error?.error === 'club_suspended') {
        auth.logout();
      }
      if (err.status === 401) {
        if (auth.isImpersonating()) {
          auth.exitImpersonation();
        } else if (auth.isTokenExpired()) {
          auth.logout();
          router.navigate(['/player-login']);
        }
      }
      return throwError(() => err);
    })
  );
};
