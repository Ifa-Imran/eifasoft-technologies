import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from './config';

/**
 * Shared routing config consumed by both the middleware and the
 * `createNavigation` helpers. `localePrefix: 'always'` guarantees every URL is
 * prefixed (e.g. `/en/dashboard`, `/ar/dashboard`) for SEO + hreflang.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  // Persist the user's language choice across sessions.
  localeDetection: true,
});
