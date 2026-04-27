import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ClubService } from '../services/club.service';
import { AuthService } from '../services/auth.service';

const SKIP_PATHS = ['/auth/', '/clubs'];

export const clubInterceptor: HttpInterceptorFn = (req, next) => {
  const clubService = inject(ClubService);
  const auth = inject(AuthService);

  const shouldSkip = SKIP_PATHS.some((path) => req.url.includes(path));
  if (shouldSkip) return next(req);

  if (req.params.has('clubId')) return next(req);

  const clubId = clubService.getSelectedClubId() ?? auth.user()?.clubId;
  if (!clubId) return next(req);

  const updatedReq = req.clone({
    params: req.params.set('clubId', clubId),
  });

  return next(updatedReq);
};
