import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const termsGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.needsTermsAcceptance()) {
    return router.createUrlTree(['/admin/accept-terms']);
  }
  return true;
};
