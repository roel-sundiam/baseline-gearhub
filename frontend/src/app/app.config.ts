import { ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { clubInterceptor } from './core/interceptors/club.interceptor';
import { ChunkErrorHandler } from './core/chunk-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: ChunkErrorHandler },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([jwtInterceptor, clubInterceptor]))
  ]
};
