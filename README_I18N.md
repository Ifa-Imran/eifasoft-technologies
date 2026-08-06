# KAIRO DAO — Internationalization (i18n) Guide

This document describes the multilingual setup for the KAIRO DAO frontend, how to add new languages, how to maintain translation files, and how to use the automated translation script.

## Overview

The KAIRO DAO frontend supports **18 languages** with full RTL support for Arabic. The implementation uses [next-intl](https://next-intl-docs.vercel.app/) v3+ with the Next.js App Router.

### Supported Languages

| Code  | Language             | Native Name   | Direction |
|-------|----------------------|---------------|-----------|
| `en`  | English (default)    | English       | LTR       |
| `fr`  | French               | Français      | LTR       |
| `es`  | Spanish              | Español       | LTR       |
| `de`  | German               | Deutsch       | LTR       |
| `ar`  | Arabic               | العربية        | **RTL**   |
| `ru`  | Russian              | Русский       | LTR       |
| `hi`  | Hindi                | हिन्दी          | LTR       |
| `th`  | Thai                 | ไทย           | LTR       |
| `ms`  | Malay                | Melayu        | LTR       |
| `id`  | Indonesian           | Indonesia     | LTR       |
| `zh`  | Chinese (Simplified) | 中文           | LTR       |
| `pt`  | Portuguese           | Português     | LTR       |
| `sw`  | Swahili              | Kiswahili     | LTR       |
| `it`  | Italian              | Italiano      | LTR       |
| `tr`  | Turkish              | Türkçe        | LTR       |
| `vi`  | Vietnamese           | Tiếng Việt    | LTR       |
| `ko`  | Korean               | 한국어          | LTR       |
| `ja`  | Japanese             | 日本語          | LTR       |

## Architecture

### File Structure

```
frontend/src/
├── i18n/
│   ├── config.ts          # Locale config, supported locales, metadata (flags, dir)
│   ├── routing.ts          # next-intl routing definition
│   ├── request.ts          # next-intl request config (lazy-loads messages)
│   ├── navigation.ts       # Link, useRouter, usePathname, redirect exports
│   └── messages/           # Translation JSON files (one per locale)
│       ├── en.json         # Base/source language
│       ├── fr.json
│       ├── ...
│       └── ja.json
├── middleware.ts           # Locale detection + redirect (next-intl middleware)
└── app/
    └── [locale]/           # All routes wrapped under locale segment
        ├── layout.tsx      # Root layout with NextIntlClientProvider
        ├── page.tsx        # Home/landing page
        ├── (app)/          # Authenticated app routes
        │   ├── dashboard/
        │   ├── stake/
        │   ├── p2p/
        │   └── ...
        ├── admin/          # Admin panel
        └── register/       # Registration
```

### How It Works

1. **Middleware** (`middleware.ts`): Detects the user's preferred locale from the `Accept-Language` header and a `NEXT_LOCALE` cookie. Redirects to `/<locale>/...` paths. Excludes `/api`, `/_next`, and static files.

2. **Routing** (`i18n/routing.ts`): Defines the locale prefix strategy (`always`), meaning all routes are prefixed with the locale (e.g., `/en/dashboard`, `/ar/dashboard`).

3. **Navigation** (`i18n/navigation.ts`): Exports `Link`, `useRouter`, `usePathname`, `redirect`, and `getPathname` from `next-intl/navigation`. These automatically handle locale prefixing.

4. **Request Config** (`i18n/request.ts`): Uses `getRequestConfig` to dynamically import the active locale's JSON file. Only the active locale's messages are loaded (lazy-loading for performance).

5. **Root Layout** (`app/[locale]/layout.tsx`): Server component that:
   - Calls `setRequestLocale(locale)` for static rendering
   - Wraps the app in `NextIntlClientProvider` with messages
   - Sets `<html lang={locale} dir={getDir(locale)}>` dynamically
   - Generates `generateStaticParams` for all locales (SSG)
   - Generates `hreflang` alternates in metadata for SEO

6. **Language Switcher** (`components/ui/LanguageSwitcher.tsx`): Custom dropdown with flag emojis, native language names, Framer Motion animations, and keyboard accessibility. Uses `router.replace(pathname, { locale })` to switch locales without full page reload.

## URL Structure

All routes are prefixed with the locale:

```
/en/dashboard     → English dashboard
/ar/dashboard     → Arabic dashboard (RTL)
/fr/stake         → French staking page
/zh/register      → Chinese registration
```

Visiting the root `/` automatically redirects to the detected locale (defaults to `/en`).

## Translation File Schema

Each `messages/<locale>.json` follows this nested structure:

```json
{
  "metadata": {
    "title": "Page title",
    "description": "Meta description",
    "ogLocale": "en_US"
  },
  "nav": {
    "home": "Home",
    "dashboard": "Dashboard",
    ...
  },
  "hero": { ... },
  "landing": { ... },
  "contracts": { ... },
  "features": { ... },
  "staking": { ... },
  "p2p": { ... },
  "referral": { ... },
  "ranks": { ... },
  "cms": { ... },
  "wallet": { ... },
  "common": { ... },
  "dashboard": { ... },
  "footer": { ... },
  "language": { ... },
  "quickActions": { ... },
  "admin": { ... },
  "register": { ... }
}
```

### Interpolation

Use `{variable}` syntax for dynamic values:

```json
{
  "referral": {
    "level": "Level {level}"
  },
  "cms": {
    "slotsRemaining": "{count} slots remaining"
  },
  "hero": {
    "liveOn": "Live on opBNB {network}"
  }
}
```

Usage in components:

```tsx
const t = useTranslations('referral');
return <span>{t('level', { level: 5 })}</span>;
```

### Preserved Terms (Do NOT Translate)

These brand names and technical terms should remain untranslated in ALL languages:

- **Brands**: KAIRO, KAIRO DAO, DAO, opBNB, USDT
- **Technical**: FIFO, APY, CMS, P2P, AMM
- **Rank Names**: Star, Crown Diamond, Bronze, Silver, Gold
- **Network**: Mainnet, Testnet

## Adding a New Language

### Step 1: Update `config.ts`

Add the new locale to the `locales` array and `localeMeta` record:

```typescript
// frontend/src/i18n/config.ts

export const locales = [
  'en', 'fr', /* ... */ 'ja',
  'nl',  // ← Add new locale
] as const;

export const localeMeta: Record<Locale, LocaleMeta> = {
  /* ... existing entries ... */
  nl: { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', flag: '🇳🇱', dir: 'ltr' },
};
```

### Step 2: Create the translation file

Copy `en.json` and translate all values:

```bash
cp frontend/src/i18n/messages/en.json frontend/src/i18n/messages/nl.json
```

Then edit `nl.json` with Dutch translations.

### Step 3: Run the translation script (optional)

Use the automated script to generate an initial translation:

```bash
node scripts/translate.js --locale=nl
```

### Step 4: Update the translate script

If the language is not already in the script's locale maps, add it to `ALL_LOCALES`, `DEEPL_LANG_MAP`, and `OPENAI_LANG_MAP` in `scripts/translate.js`.

### Step 5: Verify

- Run `npm run build` to ensure no errors
- Test the language switcher
- Verify RTL if the new locale is RTL (set `dir: 'rtl'` in config)

## Using the Translation Script

### Prerequisites

Set at least one API key:

```bash
# DeepL API (preferred for quality)
export DEEPL_API_KEY=your_deepl_auth_key

# OR OpenAI API (broader language support)
export OPENAI_API_KEY=your_openai_key
```

### Commands

```bash
# Translate ALL non-English locales
node scripts/translate.js

# Translate specific locales only
node scripts/translate.js --locale=fr,de,ar

# Preview without writing files
node scripts/translate.js --dry-run

# Force a specific provider
node scripts/translate.js --provider=openai
node scripts/translate.js --provider=deepl
```

### Provider Notes

- **DeepL**: Higher quality for supported languages. Does NOT support Malay (ms), Swahili (sw), or Vietnamese (vi) — these automatically fall back to OpenAI.
- **OpenAI**: Supports all 18 languages. Uses GPT-4o-mini with a DeFi-specialized system prompt.

### Quality Assurance

The script automatically:

1. **Preserves placeholders**: `{level}`, `{count}`, `{network}` patterns are protected during translation and restored afterward.
2. **Checks preserved terms**: Warns if brand names (KAIRO, DAO, opBNB, etc.) are missing from translations.
3. **Flags risky DeFi terms**: Identifies financially sensitive terms (stake, harvest, compound, dividend, escrow, liquidity) for manual review.
4. **Sets correct ogLocale**: Automatically assigns the correct `ogLocale` value per language.

## Using Translations in Components

### Server Components

```tsx
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

export default function StakingPage({ params: { locale } }) {
  setRequestLocale(locale);
  const t = useTranslations('staking');
  
  return <h1>{t('title')}</h1>;
}
```

### Client Components

```tsx
'use client';
import { useTranslations } from 'next-intl';

export function StakingWidget() {
  const t = useTranslations('staking');
  return <button>{t('stakeNow')}</button>;
}
```

### Multiple Namespaces

```tsx
const tNav = useTranslations('nav');
const tCommon = useTranslations('common');
```

### Navigation (locale-aware)

```tsx
import { Link, useRouter, usePathname } from '@/i18n/navigation';

// Link automatically adds locale prefix
<Link href="/dashboard">{tNav('dashboard')}</Link>

// useRouter and usePathname are locale-aware
const router = useRouter();
const pathname = usePathname(); // returns path WITHOUT locale prefix
```

### Locale-Aware Formatting

```tsx
import { useFormatter, useLocale } from 'next-intl';

function PriceDisplay({ amount }: { amount: number }) {
  const format = useFormatter();
  const locale = useLocale();
  
  return (
    <span>
      {format.number(amount, {
        style: 'currency',
        currency: 'USD',
      })}
    </span>
  );
}
```

## RTL Support (Arabic)

When `locale === 'ar'`:

- `<html dir="rtl">` is set automatically by the root layout
- Tailwind RTL utilities (`rtl:space-x-reverse`, `rtl:text-right`, etc.) can be used for layout adjustments
- The LanguageSwitcher positions itself RTL-aware (`rtl:left-0 rtl:right-auto`)
- All Radix UI components (Dialog, Tabs, Tooltip) render correctly in RTL

### RTL Best Practices

1. Use logical properties (`ms-4` instead of `ml-4`) where possible
2. Use `rtl:` Tailwind variants for directional overrides
3. Test with Arabic locale to verify mirroring
4. Ensure charts (Recharts) render correctly — may need axis reversal

## SEO

### hreflang Tags

The root layout generates `hreflang` alternates for all 18 locales:

```tsx
export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  
  return {
    alternates: {
      languages: Object.fromEntries(
        locales.map((l) => [l, `/${l}`])
      ),
    },
  };
}
```

### Meta Tags

Each locale gets:
- `<html lang="{locale}">` attribute
- `og:locale` meta tag (e.g., `fr_FR`, `ar_SA`)
- Dynamic title and description from `metadata` namespace

## Performance

- **Lazy-loading**: Only the active locale's JSON is loaded via dynamic `import()` in `request.ts`
- **Static Generation**: `generateStaticParams` pre-renders all locale/page combinations at build time
- **Server Components**: Translation lookups happen on the server, reducing client JS
- **No bundling**: Translation JSONs are NOT bundled into the client — they're loaded per-request

## Maintenance

### When to Update Translations

1. **New UI strings added**: Add to `en.json` first, then run the translate script for other locales
2. **String changes**: Update `en.json`, then re-run the script for affected locales
3. **New language added**: Follow the "Adding a New Language" steps above

### Reviewing Auto-Translations

After running the translate script:

1. Check the console output for preservation warnings
2. Review flagged DeFi terms (stake, harvest, compound, etc.)
3. Manually verify Arabic translations for RTL correctness
4. Test in the browser by switching languages

### Keeping en.json as Source of Truth

Always modify `en.json` first. It is the base schema that all other languages must match in structure. The translate script reads from `en.json` and preserves the exact key structure.

## Troubleshooting

### Missing translations (key shows as raw key path)

- Ensure the key exists in the locale's JSON file
- Check that the JSON is valid (no syntax errors)
- Verify the namespace matches in `useTranslations('namespace')`

### Build errors

- Ensure all JSON files are valid (run `node -e "JSON.parse(require('fs').readFileSync('file.json'))"`)
- Check that all locales in `config.ts` have corresponding message files
- Verify `generateStaticParams` returns all locales

### Language switcher not working

- Ensure middleware is configured correctly
- Check that the `NEXT_LOCALE` cookie is being set
- Verify `router.replace(pathname, { locale })` is called (not `router.push`)

## Dependencies

```json
{
  "next-intl": "^3.x",
  "negotiator": "^0.6.x",
  "@formatjs/intl-localematcher": "^0.5.x"
}
```

These are installed in `frontend/package.json`.
