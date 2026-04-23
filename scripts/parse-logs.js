const fs = require('fs');
const raw = fs.readFileSync('C:\\Users\\imran\\.qoder\\cache\\projects\\KAIRODAO-157a1cfd\\agent-tools\\bbb92b72\\b996fb9b.txt', 'utf8');
const data = JSON.parse(raw);

// Structure: array of { service, entries: [{ timestamp, line }] }
let allServices;
if (Array.isArray(data)) allServices = data;
else if (data.data) allServices = Array.isArray(data.data) ? data.data : [data.data];
else allServices = [data];

// Flatten all entries
let allEntries = [];
for (const svc of allServices) {
  const svcName = svc.service || 'unknown';
  const entries = svc.entries || [];
  for (const e of entries) {
    allEntries.push({ service: svcName, timestamp: e.timestamp, line: e.line });
  }
}

console.log('Total entries:', allEntries.length);

// Filter backend entries 
const backend = allEntries.filter(e => e.service.includes('backend'));
console.log('Backend entries:', backend.length);

// Look for compound/worker/team/error keywords
const keywords = ['Compound', 'compound', 'TeamEarned', 'team', 'Found', 'stakes due', 'CompoundWorker', 'Worker', 'Error', 'error', 'fail', 'FAIL', 'compoundFor', 'Processing job', 'Closing'];
const relevant = backend.filter(e => {
  return keywords.some(k => e.line && e.line.includes(k));
});

console.log('Compound/Worker/Error entries:', relevant.length);
console.log('\n--- RELEVANT BACKEND LOGS ---');
relevant.forEach(e => {
  console.log(`[${e.timestamp}] ${e.line}`);
});

// Also show last 30 backend entries for context
console.log('\n--- LAST 30 BACKEND ENTRIES ---');
backend.slice(-30).forEach(e => {
  console.log(`[${e.timestamp}] ${e.line}`);
});
