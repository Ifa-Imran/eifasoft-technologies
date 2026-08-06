/**
 * Central i18n configuration for KAIRO DAO.
 *
 * `locales` is the single source of truth for every supported locale. Add a
 * new locale here (and drop a matching `messages/<locale>.json` file) to
 * enable it across the whole app.
 */

export const locales = [
  'en',
  'fr',
  'es',
  'de',
  'ar', // RTL
  'ru',
  'hi',
  'th',
  'ms',
  'id',
  'zh',
  'pt',
  'sw',
  'it',
  'tr',
  'vi',
  'ko',
  'ja',
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Display metadata for the language switcher + <html lang>. */
export interface LocaleMeta {
  /** ISO code used in the URL segment, e.g. "ar". */
  code: Locale;
  /** Native name shown in the switcher, e.g. "العربية". */
  nativeName: string;
  /** English label for tooltips/aria, e.g. "Arabic". */
  englishName: string;
  /** Flag emoji. */
  flag: string;
  /** Text direction. */
  dir: 'ltr' | 'rtl';
}

export const localeMeta: Record<Locale, LocaleMeta> = {
  en: { code: 'en', nativeName: 'English', englishName: 'English', flag: '🇺🇸', dir: 'ltr' },
  fr: { code: 'fr', nativeName: 'Français', englishName: 'French', flag: '🇫🇷', dir: 'ltr' },
  es: { code: 'es', nativeName: 'Español', englishName: 'Spanish', flag: '🇪🇸', dir: 'ltr' },
  de: { code: 'de', nativeName: 'Deutsch', englishName: 'German', flag: '🇩🇪', dir: 'ltr' },
  ar: { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', flag: '🇸🇦', dir: 'rtl' },
  ru: { code: 'ru', nativeName: 'Русский', englishName: 'Russian', flag: '🇷🇺', dir: 'ltr' },
  hi: { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', flag: '🇮🇳', dir: 'ltr' },
  th: { code: 'th', nativeName: 'ไทย', englishName: 'Thai', flag: '🇹🇭', dir: 'ltr' },
  ms: { code: 'ms', nativeName: 'Melayu', englishName: 'Malay', flag: '🇲🇾', dir: 'ltr' },
  id: { code: 'id', nativeName: 'Indonesia', englishName: 'Indonesian', flag: '🇮🇩', dir: 'ltr' },
  zh: { code: 'zh', nativeName: '中文', englishName: 'Chinese (Simplified)', flag: '🇨🇳', dir: 'ltr' },
  pt: { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', flag: '🇵🇹', dir: 'ltr' },
  sw: { code: 'sw', nativeName: 'Kiswahili', englishName: 'Swahili', flag: '🇰🇪', dir: 'ltr' },
  it: { code: 'it', nativeName: 'Italiano', englishName: 'Italian', flag: '🇮🇹', dir: 'ltr' },
  tr: { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', flag: '🇹🇷', dir: 'ltr' },
  vi: { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', flag: '🇻🇳', dir: 'ltr' },
  ko: { code: 'ko', nativeName: '한국어', englishName: 'Korean', flag: '🇰🇷', dir: 'ltr' },
  ja: { code: 'ja', nativeName: '日本語', englishName: 'Japanese', flag: '🇯🇵', dir: 'ltr' },
};

/** Ordered list (matches priority order) for the switcher dropdown. */
export const localeList: LocaleMeta[] = locales.map((l) => localeMeta[l]);

/** True when a locale renders right-to-left (currently only Arabic). */
export function isRTL(locale: string): boolean {
  return localeMeta[locale as Locale]?.dir === 'rtl';
}

/** Returns the text direction for a locale. */
export function getDir(locale: string): 'ltr' | 'rtl' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

/** Type guard used to validate the `[locale]` segment. */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
