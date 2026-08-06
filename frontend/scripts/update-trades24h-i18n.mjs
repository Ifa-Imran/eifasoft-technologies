import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'src', 'i18n', 'messages');

// Translations for the "24h Trades" label
const translations = {
  en: '24h Trades',
  fr: 'Transactions 24h',
  es: 'Operaciones 24h',
  de: '24h Trades',
  ar: 'صفقات 24 ساعة',
  ru: 'Сделки 24ч',
  hi: '24 घंटे ट्रेड',
  th: 'เทรด 24 ชม.',
  ms: 'Perdagangan 24j',
  id: 'Perdagangan 24j',
  zh: '24小时交易',
  pt: 'Operações 24h',
  sw: 'Biashara za Saa 24',
  it: 'Operazioni 24h',
  tr: '24s İşlemler',
  vi: 'Giao dịch 24h',
  ko: '24시간 거래',
  ja: '24時間取引',
};

for (const [locale, label] of Object.entries(translations)) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Remove old key, add new key in the p2p section
  if (content.p2p) {
    delete content.p2p.filledTrades;
    content.p2p.trades24h = label;
  }

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`${locale}: filledTrades → trades24h ("${label}")`);
}
console.log('Done!');
