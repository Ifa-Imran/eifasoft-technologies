/**
 * diagnose-team-dividend.ts — Debug why team dividends aren't being generated
 * Usage: npx hardhat run scripts/diagnose-team-dividend.ts --network opbnbTestnet
 */
import { ethers } from "hardhat";

// v28 contract addresses
const STAKING_MANAGER = "0x6b7bC911393F50Ae04ed5d84E3d540c4A62b837b";
const AFFILIATE_DISTRIBUTOR = "0xdE4A258AeA1eE5Fe5f8F19E5213Ba406e1B3cA85";

const TARGET_USER = "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA";

async function main() {
  const [deployer] = await ethers.getSigners();
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);

  console.log("=== TEAM DIVIDEND DIAGNOSTIC ===");
  console.log(`Target user: ${TARGET_USER}`);
  console.log(`Deployer: ${deployer.address}\n`);

  // 1. Check if user is registered
  const referrer = await ad.referrerOf(TARGET_USER);
  console.log("--- 1. Registration ---");
  console.log(`  Referrer: ${referrer}`);
  console.log(`  Registered: ${referrer !== ethers.ZeroAddress}`);

  // 2. Check user's stakes
  console.log("\n--- 2. User Stakes ---");
  const stakes = await sm.getUserStakes(TARGET_USER);
  console.log(`  Total stakes: ${stakes.length}`);
  const userStakeVal = await sm.getTotalActiveStakeValue(TARGET_USER);
  console.log(`  Total active stake value: $${ethers.formatUnits(userStakeVal, 18)}`);
  const hasActive = await sm.hasActivePosition(TARGET_USER);
  console.log(`  Has active position: ${hasActive}`);

  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < stakes.length; i++) {
    const s = stakes[i];
    const tier = await sm.tiers(s.tier);
    const elapsed = now - Number(s.lastCompoundTime);
    const intervals = Math.floor(elapsed / Number(tier.compoundInterval));
    console.log(`\n  Stake #${i}:`);
    console.log(`    Active: ${s.active}`);
    console.log(`    Tier: ${s.tier}`);
    console.log(`    Amount: $${ethers.formatUnits(s.amount, 18)}`);
    console.log(`    Original: $${ethers.formatUnits(s.originalAmount, 18)}`);
    console.log(`    Compound earned: $${ethers.formatUnits(s.compoundEarned, 18)}`);
    console.log(`    Last compound: ${new Date(Number(s.lastCompoundTime) * 1000).toISOString()}`);
    console.log(`    Elapsed: ${elapsed}s, Intervals due: ${intervals}`);
    console.log(`    Compound interval: ${Number(tier.compoundInterval)}s`);
  }

  // 3. Walk the referral tree upward and check each upline
  console.log("\n--- 3. Referral Tree (uplines from target user) ---");
  let current = TARGET_USER;
  let level = 0;
  while (level < 20) {
    const upline = await ad.referrerOf(current);
    if (upline === ethers.ZeroAddress || upline === current) {
      console.log(`  Level ${level + 1}: END (zero address or self-referral)`);
      break;
    }
    level++;
    const upStakeVal = await sm.getTotalActiveStakeValue(upline);
    const upHasActive = await sm.hasActivePosition(upline);
    const upUnlocked = await ad.getUnlockedLevels(upline);
    const upActiveDirects = await ad.getActiveDirectCount(upline);
    const [upDirect, upTeam, upRank] = await ad.getAllIncome(upline);
    const upDirectRefs = await ad.getDirectReferrals(upline);

    console.log(`\n  Level ${level} upline: ${upline}`);
    console.log(`    Active stake value: $${ethers.formatUnits(upStakeVal, 18)}`);
    console.log(`    Has active position: ${upHasActive}`);
    console.log(`    Direct referrals: ${upDirectRefs.length}`);
    console.log(`    Active directs: ${upActiveDirects}`);
    console.log(`    Unlocked levels: ${upUnlocked}`);
    console.log(`    Income — Direct: $${ethers.formatUnits(upDirect, 18)}, Team: $${ethers.formatUnits(upTeam, 18)}, Rank: $${ethers.formatUnits(upRank, 18)}`);

    // Check their stakes too
    const upStakes = await sm.getUserStakes(upline);
    console.log(`    Stakes: ${upStakes.length}`);
    for (let i = 0; i < upStakes.length; i++) {
      const us = upStakes[i];
      console.log(`      Stake #${i}: active=${us.active}, amount=$${ethers.formatUnits(us.amount, 18)}, compoundEarned=$${ethers.formatUnits(us.compoundEarned, 18)}`);
    }

    current = upline;
  }

  // 4. Check user's own income
  console.log("\n--- 4. Target User Income ---");
  const [d, t, r] = await ad.getAllIncome(TARGET_USER);
  console.log(`  Direct: $${ethers.formatUnits(d, 18)}`);
  console.log(`  Team:   $${ethers.formatUnits(t, 18)}`);
  console.log(`  Rank:   $${ethers.formatUnits(r, 18)}`);

  // 5. Check user's direct referrals
  console.log("\n--- 5. Target User's Direct Referrals ---");
  const userDirectRefs = await ad.getDirectReferrals(TARGET_USER);
  console.log(`  Direct referrals: ${userDirectRefs.length}`);
  const userActiveDirects = await ad.getActiveDirectCount(TARGET_USER);
  console.log(`  Active directs: ${userActiveDirects}`);
  const userUnlockedLevels = await ad.getUnlockedLevels(TARGET_USER);
  console.log(`  Unlocked levels: ${userUnlockedLevels}`);

  for (const ref of userDirectRefs) {
    const refStakeVal = await sm.getTotalActiveStakeValue(ref);
    const refHasActive = await sm.hasActivePosition(ref);
    console.log(`\n  Referral: ${ref}`);
    console.log(`    Active stake: $${ethers.formatUnits(refStakeVal, 18)}, Has active position: ${refHasActive}`);

    // Check if this referral's stakes have been compounded
    const refStakes = await sm.getUserStakes(ref);
    for (let i = 0; i < refStakes.length; i++) {
      const rs = refStakes[i];
      const tier = await sm.tiers(rs.tier);
      const elapsed = now - Number(rs.lastCompoundTime);
      const intervals = Math.floor(elapsed / Number(tier.compoundInterval));
      console.log(`    Stake #${i}: active=${rs.active}, amount=$${ethers.formatUnits(rs.amount, 18)}, compoundEarned=$${ethers.formatUnits(rs.compoundEarned, 18)}, intervals_due=${intervals}`);
    }
  }

  // 6. Genesis account info
  console.log("\n--- 6. Genesis Account ---");
  const genesis = await ad.genesisAccount();
  console.log(`  Genesis: ${genesis}`);
  console.log(`  Is target the genesis? ${genesis.toLowerCase() === TARGET_USER.toLowerCase()}`);
}

main().catch(console.error);
