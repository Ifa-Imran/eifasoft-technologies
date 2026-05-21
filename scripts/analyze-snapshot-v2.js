const snap = require('../backups/snapshot.json');

console.log('=== Snapshot Global Metadata ===');
console.log('sources:', JSON.stringify(snap.sources, null, 2));
console.log('aggregates.sumSubscriptions:', snap.aggregates?.sumSubscriptions);
console.log('global.cms.totalSubscriptions:', snap.global?.cms?.totalSubscriptions);
console.log('aggregates.subscriptionCountMatchesGlobal:', snap.aggregates?.subscriptionCountMatchesGlobal);

// Count users with inCmsEvents = true
let cmsEventUsers = 0;
let cmsSubGt0 = 0;
let cmsSubGt0ButNoEvent = 0;
let cmsEventButSubZero = 0;
let stakersInSnapshot = 0;

snap.users.forEach(u => {
  const hasCmsEvent = u.sources?.inCmsEvents === true;
  const subCount = Number(u.cms?.subscriptionCount || '0');
  const hasStake = BigInt(u.staking?.derived?.activeOriginalSum || '0') > 0n;
  const isStaker = u.sources?.inAllStakers === true;

  if (hasCmsEvent) cmsEventUsers++;
  if (subCount > 0) cmsSubGt0++;
  if (subCount > 0 && !hasCmsEvent) cmsSubGt0ButNoEvent++;
  if (hasCmsEvent && subCount === 0) cmsEventButSubZero++;
  if (isStaker) stakersInSnapshot++;
});

console.log('\n=== Per-User Analysis ===');
console.log('Users with inCmsEvents=true:', cmsEventUsers);
console.log('Users with subscriptionCount > 0:', cmsSubGt0);
console.log('  ...but NOT in CMS events:', cmsSubGt0ButNoEvent);
console.log('In CMS events but subscriptionCount=0:', cmsEventButSubZero);
console.log('Users with inAllStakers=true:', stakersInSnapshot);

// Check a few CMS event users with subscriptionCount=0
console.log('\n=== Sample CMS event users with subscriptionCount=0 ===');
let count = 0;
for (const u of snap.users) {
  if (u.sources?.inCmsEvents && Number(u.cms?.subscriptionCount || '0') === 0) {
    console.log(`  ${u.user}: subscriptionCount=${u.cms?.subscriptionCount}, cmsDirectCount=${u.cms?.cmsDirectCount}`);
    if (++count >= 5) break;
  }
}

// Now check: what if we use inCmsEvents OR inAllStakers to determine eligibility?
// For CMS users without subscriptionCount, assume 1 subscription ($10)
let eligibleV2 = 0;
let totalPrincipalV2 = 0n;
const CMS_PRICE = 10000000000000000000n; // 10e18

snap.users.forEach(u => {
  const subCount = BigInt(u.cms?.subscriptionCount || '0');
  const stakeAmt = BigInt(u.staking?.derived?.activeOriginalSum || '0');
  const hasCmsEvent = u.sources?.inCmsEvents === true;
  const isStaker = u.sources?.inAllStakers === true;
  
  let principal = 0n;
  
  // CMS contribution
  if (subCount > 0n) {
    principal += subCount * CMS_PRICE;
  } else if (hasCmsEvent) {
    // Has CMS event but subscriptionCount=0 - use 1 as minimum
    principal += CMS_PRICE;
  }
  
  // Stake contribution
  principal += stakeAmt;
  
  if (principal > 0n) eligibleV2++;
  totalPrincipalV2 += principal;
});

console.log('\n=== V2 Eligibility (using inCmsEvents flag as fallback) ===');
console.log('Eligible users:', eligibleV2);
console.log('Total principal:', (totalPrincipalV2 / 1000000000000000000n).toString(), 'USDT');

// Check staking data - are stakes stored differently?
console.log('\n=== Staking check ===');
let usersWithStakes = 0;
let usersWithActiveOriginal = 0;
snap.users.forEach(u => {
  if (u.staking?.stakes?.length > 0) usersWithStakes++;
  if (BigInt(u.staking?.derived?.activeOriginalSum || '0') > 0n) usersWithActiveOriginal++;
});
console.log('Users with stakes[] array non-empty:', usersWithStakes);
console.log('Users with activeOriginalSum > 0:', usersWithActiveOriginal);
