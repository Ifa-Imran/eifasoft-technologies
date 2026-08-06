import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Locale detection + redirect middleware.
 *
 * - Detects the preferred locale from the `NEXT_LOCALE` cookie, then the
 *   `Accept-Language` header (via next-intl's negotiator/intl-localematcher).
 * - Persists the chosen locale in the `NEXT_LOCALE` cookie.
 * - Prefixes every route with the locale segment.
 */
export default createMiddleware(routing);

export const config = {
  // Run on all paths except Next internals, API routes, and static assets.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
