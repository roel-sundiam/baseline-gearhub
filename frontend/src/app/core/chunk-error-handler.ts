import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class ChunkErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('error loading dynamically imported module');

    if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
      return;
    }

    console.error(error);
  }
}
