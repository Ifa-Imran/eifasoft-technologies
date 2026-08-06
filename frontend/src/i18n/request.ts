import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale } from './config';
import { routing } from './routing';

/**
 * Server-side request config for next-intl. Only the active locale's JSON is
 * loaded (lazy, per-request) — never bundled all at once on the client.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
