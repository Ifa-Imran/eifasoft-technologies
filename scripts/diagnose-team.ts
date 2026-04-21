/**
 * diagnose-team.ts — Diagnose team dividend issues
 */
import { ethers } from "hardhat";

const STAKING_MANAGER = "0xD53Dc5285aC6514bec61d7421247a0E04144394c";
const AFFILIATE_DISTRIBUTOR = "0x022FE670C8870081f9Ff661dd6818339C08B2295";

async function main() {
  const [deployer] = await ethers.getSigners();
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);

  console.log("=== TEAM DIVIDEND DIAGNOSIS ===\n");

  // Check genesis
  const genesis = await ad.genesisAccount();
  console.log(`Genesis Account: ${genesis}`);
  console.log(`Deployer:        ${deployer.address}`);
  console.log(`Is deployer genesis? ${genesis.toLowerCase() === deployer.address.toLowerCase()}\n`);

  // Get all users in the referral tree
  const directs = await ad.getDirectReferrals(deployer.address);
  console.log(`Deployer direct referrals: ${directs.length}`);

  for (const ref of directs) {
    const refStake = await sm.getTotalActiveStakeValue(ref);
    const refHasActive = await sm.hasActivePosition(ref);
    const refReferrer = await ad.referrerOf(ref);
    console.log(`\n  [L1] ${ref}`);
    console.log(`    Referrer: ${refReferrer}`);
    console.log(`    Active Stake: $${ethers.formatUnits(refStake, 18)}`);
    console.log(`    Has Active Position: ${refHasActive}`);

    // Check their sub-referrals
    const subRefs = await ad.getDirectReferrals(ref);
    console.log(`    Direct Referrals: ${subRefs.length}`);

    for (const sub of subRefs) {
      const subStake = await sm.getTotalActiveStakeValue(sub);
      const subHasActive = await sm.hasActivePosition(sub);
      const subReferrer = await ad.referrerOf(sub);
      const subStakes = await sm.getUserStakes(sub);
      console.log(`\n    [L2] ${sub}`);
      console.log(`      Referrer: ${subReferrer}`);
      console.log(`      Active Stake: $${ethers.formatUnits(subStake, 18)}`);
      console.log(`      Has Active Position: ${subHasActive}`);
      console.log(`      Stakes: ${subStakes.length}`);

      for (let i = 0; i < subStakes.length; i++) {
        const s = subStakes[i];
        console.log(`        Stake #${i}: active=${s.active}, amount=$${ethers.formatUnits(s.amount, 18)}, tier=${s.tier}`);
      }
    }
  }

  // Check deployer's own state
  const deployerStake = await sm.getTotalActiveStakeValue(deployer.address);
  const deployerHasActive = await sm.hasActivePosition(deployer.address);
  const deployerUnlocked = await ad.getUnlockedLevels(deployer.address);
  const deployerActiveDirects = await ad.getActiveDirectCount(deployer.address);

  console.log(`\n=== DEPLOYER STATE ===`);
  console.log(`  Active Stake: $${ethers.formatUnits(deployerStake, 18)}`);
  console.log(`  Has Active Position: ${deployerHasActive}`);
  console.log(`  Active Directs: ${deployerActiveDirects}`);
  console.log(`  Unlocked Levels: ${deployerUnlocked}`);

  console.log(`\n=== WHY TEAM DIVIDENDS ARE ZERO ===`);
  if (deployerStake === 0n) {
    console.log(`  ❌ Deployer has NO active stake — team dividends require active stake on upline`);
    if (genesis.toLowerCase() === deployer.address.toLowerCase()) {
      console.log(`  ❌ Deployer IS the genesis account — genesis CANNOT stake per contract rules`);
      console.log(`  → Genesis can NEVER receive team dividends`);
    }
  }
  if (deployerUnlocked === 0n) {
    console.log(`  ❌ Deployer has 0 unlocked levels — needs active direct referrals`);
  }

  // Check L1 referral state for team dividends
  for (const ref of directs) {
    const refStake = await sm.getTotalActiveStakeValue(ref);
    const refUnlocked = await ad.getUnlockedLevels(ref);
    const refActiveDirects = await ad.getActiveDirectCount(ref);
    console.log(`\n  --- L1 Referral: ${ref.slice(0, 10)}... ---`);
    console.log(`  Active Stake: $${ethers.formatUnits(refStake, 18)}`);
    console.log(`  Active Directs: ${refActiveDirects}`);
    console.log(`  Unlocked Levels: ${refUnlocked}`);
    if (refStake === 0n) {
      console.log(`  ❌ No active stake — cannot receive team dividends`);
    }
    if (refUnlocked === 0n) {
      console.log(`  ❌ 0 unlocked levels — needs active direct referrals`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
