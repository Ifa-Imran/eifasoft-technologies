/**
 * Sync missing i18n keys from the English source (en.json) into every other
 * locale file. Existing translations are preserved; only missing keys are
 * added (with the English value as a fallback so the app never crashes on a
 * missing message).
 *
 * Usage:  node scripts/sync-i18n.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(__dirname, '..', 'src', 'i18n', 'messages');

const en = JSON.parse(readFileSync(join(messagesDir, 'en.json'), 'utf8'));

/**
 * Deep-merge: for every key in `source`, if the key is missing in `target`
 * (or the value types differ), copy the source value. Recursively merge
 * nested objects.
 */
function deepMergeMissing(target, source) {
  let added = 0;
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (tv === undefined || tv === null) {
      target[key] = sv;
      added++;
    } else if (typeof sv === 'object' && !Array.isArray(sv) && typeof tv === 'object' && !Array.isArray(tv)) {
      added += deepMergeMissing(tv, sv);
    } else if (typeof sv !== typeof tv) {
      // type mismatch → overwrite with source
      target[key] = sv;
      added++;
    }
  }
  return added;
}

const localeFiles = readdirSync(messagesDir)
  .filter((f) => f.endsWith('.json') && f !== 'en.json')
  .sort();

let totalAdded = 0;

for (const file of localeFiles) {
  const filePath = join(messagesDir, file);
  const locale = file.replace('.json', '');
  const content = JSON.parse(readFileSync(filePath, 'utf8'));
  const added = deepMergeMissing(content, en);

  if (added > 0) {
    writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
    console.log(`${locale}: added ${added} missing key(s)`);
  } else {
    console.log(`${locale}: already up to date`);
  }
  totalAdded += added;
}

console.log(`\nDone. ${totalAdded} total key(s) synced across ${localeFiles.length} locale files.`);
