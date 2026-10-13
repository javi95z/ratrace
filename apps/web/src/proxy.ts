import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/** Sends a visitor to `/en/...`, `/es/...` or `/ru/...`, following their browser on the first visit. */
export default createMiddleware(routing);

export const config = {
  // Everything except Next.js internals and files with an extension, such as sprites.
  matcher: '/((?!_next|_vercel|.*\\..*).*)',
};
