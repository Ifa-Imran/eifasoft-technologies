const fs = require('fs');
const path = require('path');

const snap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backups', 'snapshot.json'), 'utf8'));
const users = snap.users || [];
const ZERO = '0x0000000000000000000000000000000000000000';

let zeroRef = 0, nonZeroRef = 0;
let totalDirects = 0;
const refMap = {}; // referrer -> count of users referring to them

for (const u of users) {
  const ref = (u.affiliate && u.affiliate.referrer ? u.affiliate.referrer : '').toLowerCase();
  if (!ref || ref === ZERO) {
    zeroRef++;
  } else {
    nonZeroRef++;
    refMap[ref] = (refMap[ref] || 0) + 1;
  }
  const directs = (u.affiliate && u.affiliate.directReferrals) || [];
  totalDirects += directs.length;
}

console.log('Total users          :', users.length);
console.log('NonZero referrer     :', nonZeroRef);
console.log('Zero referrer        :', zeroRef);
console.log('Total direct entries :', totalDirects);
console.log('Unique referrers seen:', Object.keys(refMap).length);

// Top 10 referrers
const top = Object.entries(refMap).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('\nTop referrers:');
for (const [addr, count] of top) {
  console.log(`  ${addr}: ${count} directs`);
}

// Find users who have many directReferrals listed
const usersWithDirects = users
  .filter(u => (u.affiliate && u.affiliate.directReferrals && u.affiliate.directReferrals.length > 0))
  .map(u => ({ user: u.user, count: u.affiliate.directReferrals.length }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 15);
console.log('\nTop users by directReferrals[] length:');
for (const u of usersWithDirects) {
  console.log(`  ${u.user}: ${u.count} directs`);
}
