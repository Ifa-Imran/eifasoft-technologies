import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale } from './config';
import { routing } from './routing';

/**
 * Deep-merge helper: `fallback` provides defaults, `target` overrides.
 * Nested plain objects merge recursively; everything else is replaced.
 */
function mergeMessages(
  fallback: Record<string, unknown>,
  target: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fallback };
  for (const [key, value] of Object.entries(target)) {
    const base = out[key];
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value) &&
      base && typeof base === 'object' && !Array.isArray(base)
        ? mergeMessages(base as Record<string, unknown>, value as Record<string, unknown>)
        : value;
  }
  return out;
}

/**
 * Server-side request config for next-intl. Only the active locale's JSON is
 * loaded (lazy, per-request) — never bundled all at once on the client.
 * The active locale's messages are deep-merged over the English defaults so a
 * namespace or key missing from a locale file falls back to English instead
 * of rendering a raw key path (e.g. "p2pHistory.title").
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;

  const messages = (await import(`./messages/${locale}.json`)).default;
  const enMessages = (await import(`./messages/${defaultLocale}.json`)).default;

  return {
    locale,
    messages: locale === defaultLocale ? messages : mergeMessages(enMessages, messages),
  };
});
