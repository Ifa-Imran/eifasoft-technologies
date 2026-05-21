const snap = require('../backups/snapshot.json');
const users = new Set(snap.users.map(u => u.user.toLowerCase()));
const refCounts = {};
let inSet = 0, notInSet = 0, zeroRef = 0;

snap.users.forEach(u => {
  const ref = (u.affiliate?.referrer || '0x0000000000000000000000000000000000000000').toLowerCase();
  if (ref === '0x0000000000000000000000000000000000000000') {
    zeroRef++;
  } else if (users.has(ref)) {
    inSet++;
    refCounts[ref] = (refCounts[ref] || 0) + 1;
  } else {
    notInSet++;
    refCounts[ref] = (refCounts[ref] || 0) + 1;
  }
});

console.log('=== Snapshot Referrer Analysis ===');
console.log('Total users:', snap.users.length);
console.log('Referrer IN set (chainable):', inSet);
console.log('Referrer NOT in set (grafted):', notInSet);
console.log('Referrer is 0x0 (genesis/root):', zeroRef);

console.log('\n--- Top referrers (most children) ---');
const sorted = Object.entries(refCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
sorted.forEach(([addr, count]) => {
  console.log(`  ${count} refs → ${addr} ${users.has(addr) ? '✓ IN-SET' : '✗ NOT-IN-SET'}`);
});

// Also count directReferrals total
let totalDR = 0;
let usersWithDR = 0;
snap.users.forEach(u => {
  const dr = u.affiliate?.directReferrals || [];
  if (dr.length > 0) { usersWithDR++; totalDR += dr.length; }
});
console.log('\n--- directReferrals arrays ---');
console.log('Users with non-empty directReferrals:', usersWithDR);
console.log('Total directReferrals entries:', totalDR);

// Check if directReferrals entries are all in the 435 set
let drInSet = 0, drNotInSet = 0;
snap.users.forEach(u => {
  (u.affiliate?.directReferrals || []).forEach(child => {
    if (users.has(child.toLowerCase())) drInSet++;
    else drNotInSet++;
  });
});
console.log('directReferrals entries IN set:', drInSet);
console.log('directReferrals entries NOT in set:', drNotInSet);
