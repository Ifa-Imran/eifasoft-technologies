const fs = require('fs');
const snap = JSON.parse(fs.readFileSync('backups/snapshot.json', 'utf8'));
const ZERO = '0x0000000000000000000000000000000000000000';
const genesis = snap.global.affiliate.genesisAccount.toLowerCase();

console.log('snapshot genesis:', genesis);

// Build referrer counts and find roots
const refCounts = {};
const userSet = new Set();
let nullRefCount = 0;
let selfRefCount = 0;

for (const u of snap.users) {
  const user = u.user.toLowerCase();
  const ref = (u.affiliate.referrer || ZERO).toLowerCase();
  userSet.add(user);
  if (ref === ZERO) {
    nullRefCount++;
    continue;
  }
  if (ref === user) {
    selfRefCount++;
    continue;
  }
  refCounts[ref] = (refCounts[ref] || 0) + 1;
}

console.log('users with referrer = 0x0:', nullRefCount);
console.log('users with self-referrer:', selfRefCount);

// Top 10 most-referenced addresses (likely upper-level uplines)
const top = Object.entries(refCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('\nTop 15 most-referenced addresses:');
for (const [addr, count] of top) {
  const isInUserSet = userSet.has(addr);
  const isGenesis = addr === genesis;
  console.log(`  ${addr}  count=${count}  inSnapshot=${isInUserSet}  isGenesis=${isGenesis}`);
}

// How many users have a referrer that is in the user set?
let inSetRef = 0;
let outOfSetRef = 0;
const missingReferrers = new Set();
for (const u of snap.users) {
  const ref = (u.affiliate.referrer || ZERO).toLowerCase();
  if (ref === ZERO) continue;
  if (userSet.has(ref)) inSetRef++;
  else {
    outOfSetRef++;
    missingReferrers.add(ref);
  }
}
console.log(`\nReferrers IN user set: ${inSetRef}`);
console.log(`Referrers NOT in user set: ${outOfSetRef} (unique: ${missingReferrers.size})`);
console.log(`Sample missing referrers:`, Array.from(missingReferrers).slice(0, 5));

// Find the root: an address that is referenced but has no ref-of itself in snapshot,
// or whose ref-of is itself / null
console.log('\nLooking for potential roots (addresses referenced by others but not registered):');
for (const [addr, count] of top.slice(0, 5)) {
  const userRecord = snap.users.find(u => u.user.toLowerCase() === addr);
  if (userRecord) {
    console.log(`  ${addr} -> their ref=${userRecord.affiliate.referrer.toLowerCase()}, count=${count}`);
  } else {
    console.log(`  ${addr} -> NOT IN SNAPSHOT (referenced by ${count} but no record)`);
  }
}
