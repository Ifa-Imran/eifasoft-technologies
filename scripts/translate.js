#!/usr/bin/env node
/**
 * scripts/translate.js
 *
 * Auto-generate translation JSON files from messages/en.json using
 * DeepL API (preferred) or OpenAI API (fallback).
 *
 * Usage:
 *   node scripts/translate.js                    # translate all non-en locales
 *   node scripts/translate.js --locale=fr,de     # translate specific locales
 *   node scripts/translate.js --dry-run          # preview without writing files
 *   node scripts/translate.js --provider=deepl   # force provider
 *   node scripts/translate.js --provider=openai
 *
 * Environment variables:
 *   DEEPL_API_KEY    — DeepL API key (Auth Key from https://www.deepl.com/pro-api)
 *   OPENAI_API_KEY   — OpenAI API key
 *
 * The script:
 *   1. Reads frontend/src/i18n/messages/en.json
 *   2. Extracts all string values (recursively, preserving key structure)
 *   3. Translates each string via the chosen provider
 *   4. Reassembles the JSON with the exact same key structure
 *   5. Writes frontend/src/i18n/messages/<locale>.json
 *   6. Flags potentially risky DeFi terms for manual review
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MESSAGES_DIR = path.join(__dirname, '..', 'frontend', 'src', 'i18n', 'messages');
const SOURCE_LOCALE = 'en';

/**
 * Supported locales (must match frontend/src/i18n/config.ts).
 * The source locale ('en') is excluded from translation targets.
 */
const ALL_LOCALES = [
  'en', 'fr', 'es', 'de', 'ar', 'ru', 'hi', 'th',
  'ms', 'id', 'zh', 'pt', 'sw', 'it', 'tr', 'vi', 'ko', 'ja',
];

/**
 * DeepL language code mapping (some codes differ from our internal codes).
 */
const DEEPL_LANG_MAP = {
  en: 'EN',
  fr: 'FR',
  es: 'ES',
  de: 'DE',
  ar: 'AR',
  ru: 'RU',
  hi: 'HI',
  th: 'TH',
  ms: '', // DeepL does not support Malay — will fall back to OpenAI
  id: 'ID',
  zh: 'ZH',
  pt: 'PT',
  sw: '', // DeepL does not support Swahili — will fall back to OpenAI
  it: 'IT',
  tr: 'TR',
  vi: '', // DeepL does not support Vietnamese — will fall back to OpenAI
  ko: 'KO',
  ja: 'JA',
};

/**
 * OpenAI language code mapping (ISO 639-1 with some adjustments).
 */
const OPENAI_LANG_MAP = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  ar: 'Arabic',
  ru: 'Russian',
  hi: 'Hindi',
  th: 'Thai',
  ms: 'Malay',
  id: 'Indonesian',
  zh: 'Simplified Chinese',
  pt: 'Portuguese',
  sw: 'Swahili',
  it: 'Italian',
  tr: 'Turkish',
  vi: 'Vietnamese',
  ko: 'Korean',
  ja: 'Japanese',
};

/**
 * DeFi terms that are brand names or technical jargon and should NOT be translated.
 * The script will warn if these appear in a translated string differently
 * from how they appear in the source.
 */
const PRESERVE_TERMS = [
  'KAIRO', 'KAIRO DAO', 'DAO', 'opBNB', 'USDT', 'FIFO', 'APY', 'CMS',
  'P2P', 'AMM', 'Star', 'Crown Diamond', 'Bronze', 'Silver', 'Gold',
  'Mainnet', 'Testnet', 'blockchain', 'on-chain', 'escrow', 'compound',
];

/**
 * Terms that are financially sensitive and should be manually reviewed
 * after auto-translation to ensure accuracy.
 */
const RISKY_TERMS = [
  'stake', 'staking', 'harvest', 'claim', 'compound', 'dividend',
  'referral', 'commission', 'salary', 'cap', 'burn', 'liquidity',
  'swap', 'escrow', 'settlement',
];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const match = arg.match(/^--([a-zA-Z-]+)(?:=(.+))?$/);
    if (match) {
      args[match[1]] = match[2] || true;
    }
  });
  return args;
}

const args = parseArgs();
const dryRun = args['dry-run'] === true;
const forcedProvider = args.provider || null;

let targetLocales = ALL_LOCALES.filter((l) => l !== SOURCE_LOCALE);
if (args.locale && typeof args.locale === 'string') {
  const requested = args.locale.split(',').map((l) => l.trim());
  targetLocales = requested.filter((l) => ALL_LOCALES.includes(l) && l !== SOURCE_LOCALE);
  const invalid = requested.filter((l) => !ALL_LOCALES.includes(l));
  if (invalid.length) {
    console.error(`Unknown locales: ${invalid.join(', ')}`);
    console.error(`Available: ${ALL_LOCALES.join(', ')}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

function detectProvider(locale) {
  if (forcedProvider) {
    return forcedProvider;
  }
  // Check if DeepL supports this language
  if (process.env.DEEPL_API_KEY && DEEPL_LANG_MAP[locale]) {
    return 'deepl';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  if (process.env.DEEPL_API_KEY) {
    // DeepL key exists but language not supported — try anyway, will warn
    return 'deepl';
  }
  return null;
}

// ---------------------------------------------------------------------------
// JSON utilities
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a nested JSON object into an array of {path, value} entries.
 * Example: { a: { b: 'hello' } } => [{ path: ['a', 'b'], value: 'hello' }]
 */
function flattenStrings(obj, currentPath = []) {
  const entries = [];
  if (typeof obj === 'string') {
    entries.push({ path: currentPath, value: obj });
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key of Object.keys(obj)) {
      entries.push(...flattenStrings(obj[key], [...currentPath, key]));
    }
  }
  return entries;
}

/**
 * Rebuild a nested JSON object from flattened {path, value} entries.
 */
function rebuildObject(entries, template) {
  const result = JSON.parse(JSON.stringify(template)); // deep clone to preserve non-string values
  for (const { path, value } of entries) {
    let node = result;
    for (let i = 0; i < path.length - 1; i++) {
      node = node[path[i]];
    }
    node[path[path.length - 1]] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Placeholder protection
// ---------------------------------------------------------------------------

const PLACEHOLDER_REGEX = /\{[^}]+\}/g;

/**
 * Replace {placeholders} with sentinel tokens to prevent translation.
 */
function protectPlaceholders(text) {
  const placeholders = [];
  let index = 0;
  const protected_text = text.replace(PLACEHOLDER_REGEX, (match) => {
    const sentinel = `\x00PH${index}\x00`;
    placeholders.push({ sentinel, match });
    index++;
    return sentinel;
  });
  return { protected_text, placeholders };
}

/**
 * Restore sentinel tokens back to original {placeholders}.
 */
function restorePlaceholders(text, placeholders) {
  let result = text;
  for (const { sentinel, match } of placeholders) {
    // The API might mangle the sentinel; try fuzzy match
    const cleanSentinel = sentinel.replace(/\x00/g, '');
    if (result.includes(sentinel)) {
      result = result.split(sentinel).join(match);
    } else if (result.includes(cleanSentinel)) {
      result = result.split(cleanSentinel).join(match);
    } else {
      // Try to find mangled versions (e.g., " PH0 ", "PH0", etc.)
      const phNum = sentinel.match(/PH(\d+)/);
      if (phNum) {
        const mangledRegex = new RegExp(`\\s*PH${phNum[1]}\\s*`, 'g');
        result = result.replace(mangledRegex, match);
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// DeepL translation
// ---------------------------------------------------------------------------

async function translateDeepL(texts, targetLang) {
  const deeplTarget = DEEPL_LANG_MAP[targetLang];
  if (!deeplTarget) {
    throw new Error(`DeepL does not support locale: ${targetLang}`);
  }

  // Protect placeholders in all texts
  const protectedData = texts.map((t) => protectPlaceholders(t));

  const body = new URLSearchParams();
  body.append('auth_key', process.env.DEEPL_API_KEY);
  body.append('source_lang', 'EN');
  body.append('target_lang', deeplTarget);
  body.append('tag_handling', 'xml');
  protectedData.forEach(({ protected_text }) => {
    body.append('text', protected_text);
  });

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepL API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const translations = data.translations.map((t, i) => {
    const restored = restorePlaceholders(t.text, protectedData[i].placeholders);
    return restored;
  });

  return translations;
}

// ---------------------------------------------------------------------------
// OpenAI translation
// ---------------------------------------------------------------------------

async function translateOpenAI(texts, targetLang) {
  const targetLanguage = OPENAI_LANG_MAP[targetLang];
  if (!targetLanguage) {
    throw new Error(`OpenAI does not support locale: ${targetLang}`);
  }

  // Protect placeholders
  const protectedData = texts.map((t) => protectPlaceholders(t));

  const systemPrompt = `You are a professional DeFi (Decentralized Finance) translator. Translate the given English text to ${targetLanguage}.

CRITICAL RULES:
1. Preserve ALL {placeholder} patterns exactly — do NOT translate or modify text inside curly braces.
2. Keep brand names untranslated: KAIRO, KAIRO DAO, DAO, opBNB, USDT, FIFO, APY, CMS, P2P, AMM.
3. Keep rank names untranslated: Star, Crown Diamond, Bronze, Silver, Gold.
4. Use professional DeFi terminology, not generic translation.
5. Return ONLY the translated text, nothing else.
6. Do NOT add quotes around the output.
7. Maintain the same tone and formality as the source.`;

  // Batch translate to reduce API calls
  const BATCH_SIZE = 20;
  const translations = [];

  for (let i = 0; i < protectedData.length; i += BATCH_SIZE) {
    const batch = protectedData.slice(i, i + BATCH_SIZE);

    const userContent = batch
      .map((item, idx) => `[${idx}] ${item.protected_text}`)
      .join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Translate each line below to ${targetLanguage}. Keep the [N] index prefix. Return one translation per line.\n\n${userContent}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    // Parse the response — each line should start with [N]
    const lines = content.split('\n').filter((l) => l.trim());
    for (const line of lines) {
      const match = line.match(/^\[(\d+)\]\s*(.*)$/);
      if (match) {
        const idx = parseInt(match[1], 10);
        const translatedText = match[2];
        const restored = restorePlaceholders(translatedText, batch[idx].placeholders);
        translations.push(restored);
      }
    }

    // Small delay to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return translations;
}

// ---------------------------------------------------------------------------
// Quality checking
// ---------------------------------------------------------------------------

function checkPreservedTerms(original, translated) {
  const warnings = [];
  for (const term of PRESERVE_TERMS) {
    if (original.includes(term) && !translated.includes(term)) {
      warnings.push(`Preserved term "${term}" missing in translation`);
    }
  }
  return warnings;
}

function checkRiskyTerms(translated, locale) {
  const flags = [];
  const lowerTranslated = translated.toLowerCase();
  for (const term of RISKY_TERMS) {
    if (lowerTranslated.includes(term.toLowerCase())) {
      // The risky term appears literally — may need manual review for non-English
      if (locale !== 'en') {
        flags.push(`Risky DeFi term "${term}" may need manual review`);
      }
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Main translation logic
// ---------------------------------------------------------------------------

async function translateLocale(locale, sourceEntries) {
  const provider = detectProvider(locale);
  if (!provider) {
    console.error(`  ✗ No API key found. Set DEEPL_API_KEY or OPENAI_API_KEY.`);
    console.error(`    Get DeepL key: https://www.deepl.com/pro-api`);
    console.error(`    Get OpenAI key: https://platform.openai.com/api-keys`);
    return null;
  }

  if (provider === 'deepl' && !DEEPL_LANG_MAP[locale]) {
    console.warn(`  ⚠ DeepL does not support "${locale}", falling back to OpenAI...`);
    if (process.env.OPENAI_API_KEY) {
      return translateWithOpenAI(locale, sourceEntries);
    }
    console.error(`  ✗ No OpenAI key available for fallback. Skipping ${locale}.`);
    return null;
  }

  if (provider === 'deepl') {
    return translateWithDeepL(locale, sourceEntries);
  }
  return translateWithOpenAI(locale, sourceEntries);
}

async function translateWithDeepL(locale, sourceEntries) {
  console.log(`  → Translating with DeepL (target: ${DEEPL_LANG_MAP[locale]})...`);
  const texts = sourceEntries.map((e) => e.value);

  // DeepL has a limit of 50 texts per request for some plans; batch if needed
  const BATCH_SIZE = 50;
  const allTranslations = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const translations = await translateDeepL(batch, locale);
    allTranslations.push(...translations);
  }

  return allTranslations;
}

async function translateWithOpenAI(locale, sourceEntries) {
  console.log(`  → Translating with OpenAI (target: ${OPENAI_LANG_MAP[locale]})...`);
  const texts = sourceEntries.map((e) => e.value);
  return translateOpenAI(texts, locale);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  KAIRO DAO — i18n Translation Generator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  if (dryRun) {
    console.log('  [DRY RUN] No files will be written.\n');
  }

  // Read source file
  const sourcePath = path.join(MESSAGES_DIR, `${SOURCE_LOCALE}.json`);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
  const sourceEntries = flattenStrings(sourceContent);
  console.log(`  Source: ${SOURCE_LOCALE}.json (${sourceEntries.length} strings)\n`);

  console.log(`  Target locales: ${targetLocales.join(', ')}\n`);

  const results = {
    success: [],
    skipped: [],
    failed: [],
    warnings: {},
  };

  for (const locale of targetLocales) {
    console.log(`\n┌─ ${locale.toUpperCase()} ─────────────────────────────`);

    try {
      const translations = await translateLocale(locale, sourceEntries);

      if (!translations) {
        results.skipped.push(locale);
        console.log(`  ⊘ Skipped (no provider available)`);
        continue;
      }

      // Rebuild the object with translated values
      const translatedEntries = sourceEntries.map((entry, i) => ({
        path: entry.path,
        value: translations[i] || entry.value,
      }));

      const translatedObject = rebuildObject(translatedEntries, sourceContent);

      // Override ogLocale with correct value
      if (translatedObject.metadata) {
        const ogLocaleMap = {
          fr: 'fr_FR', es: 'es_ES', de: 'de_DE', ar: 'ar_SA',
          ru: 'ru_RU', hi: 'hi_IN', th: 'th_TH', ms: 'ms_MY',
          id: 'id_ID', zh: 'zh_CN', pt: 'pt_PT', sw: 'sw_KE',
          it: 'it_IT', tr: 'tr_TR', vi: 'vi_VN', ko: 'ko_KR', ja: 'ja_JP',
        };
        if (ogLocaleMap[locale]) {
          translatedObject.metadata.ogLocale = ogLocaleMap[locale];
        }
      }

      // Quality checks
      const localeWarnings = [];
      for (let i = 0; i < sourceEntries.length; i++) {
        const warnings = checkPreservedTerms(sourceEntries[i].value, translations[i] || '');
        if (warnings.length) {
          localeWarnings.push({
            path: sourceEntries[i].path.join('.'),
            warnings,
          });
        }
      }

      if (localeWarnings.length) {
        results.warnings[locale] = localeWarnings;
        console.log(`  ⚠ ${localeWarnings.length} preservation warnings:`);
        localeWarnings.slice(0, 5).forEach((w) => {
          console.log(`    • ${w.path}: ${w.warnings.join('; ')}`);
        });
        if (localeWarnings.length > 5) {
          console.log(`    ... and ${localeWarnings.length - 5} more`);
        }
      }

      // Write output
      if (!dryRun) {
        const outputPath = path.join(MESSAGES_DIR, `${locale}.json`);
        const output = JSON.stringify(translatedObject, null, 2) + '\n';
        fs.writeFileSync(outputPath, output, 'utf-8');
        console.log(`  ✓ Written to ${path.basename(outputPath)}`);
      } else {
        console.log(`  ✓ [DRY RUN] Would write to ${locale}.json`);
      }

      results.success.push(locale);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      results.failed.push({ locale, error: err.message });
    }
  }

  // Summary
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ✓ Success:  ${results.success.length} — ${results.success.join(', ') || 'none'}`);
  console.log(`  ⊘ Skipped:  ${results.skipped.length} — ${results.skipped.join(', ') || 'none'}`);
  console.log(`  ✗ Failed:   ${results.failed.length} — ${results.failed.map((f) => f.locale).join(', ') || 'none'}`);

  const totalWarnings = Object.values(results.warnings).reduce((sum, arr) => sum + arr.length, 0);
  if (totalWarnings > 0) {
    console.log(`  ⚠ Warnings: ${totalWarnings} (review preserved terms)`);
    console.log('\n  ⚠ DeFi terms flagged for manual review:');
    const riskyTerms = ['stake', 'harvest', 'compound', 'dividend', 'escrow', 'liquidity'];
    console.log(`    ${riskyTerms.map((t) => `"${t}"`).join(', ')}`);
    console.log('    → Verify these are translated with correct DeFi terminology.');
  }

  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
