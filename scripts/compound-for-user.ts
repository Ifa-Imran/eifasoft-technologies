/**
 * compound-for-user.ts — Compound all due stakes for users in a subtree
 * Usage: npx hardhat run scripts/compound-for-user.ts --network opbnbTestnet
 */
import { ethers } from "hardhat";

const STAKING_MANAGER = "0x6b7bC911393F50Ae04ed5d84E3d540c4A62b837b";
const AFFILIATE_DISTRIBUTOR = "0xdE4A258AeA1eE5Fe5f8F19E5213Ba406e1B3cA85";

const TARGET_USER = "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA";

async function main() {
  const [deployer] = await ethers.getSigners();
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);

  console.log("=== COMPOUND FOR USER & REFERRALS ===");
  console.log(`Signer: ${deployer.address}\n`);

  // Get user's income before
  const [d1, t1, r1] = await ad.getAllIncome(TARGET_USER);
  console.log("--- Before ---");
  console.log(`  Direct: $${ethers.formatUnits(d1, 18)}, Team: $${ethers.formatUnits(t1, 18)}, Rank: $${ethers.formatUnits(r1, 18)}`);

  // Compound target user's own stakes
  const userStakes = await sm.getUserStakes(TARGET_USER);
  for (let i = 0; i < userStakes.length; i++) {
    if (!userStakes[i].active) continue;
    try {
      const tx = await sm.compoundFor(TARGET_USER, i);
      await tx.wait();
      console.log(`\n  ✓ Compounded ${TARGET_USER.slice(0,10)}... stakeId=${i}`);
    } catch (err: any) {
      console.log(`  ✗ Skip ${TARGET_USER.slice(0,10)}... stakeId=${i}: ${err.message?.slice(0, 80)}`);
    }
  }

  // Compound all referrals' stakes (these generate team dividends for target user)
  const refs = await ad.getDirectReferrals(TARGET_USER);
  console.log(`\nCompounding ${refs.length} direct referrals...`);

  for (const ref of refs) {
    const refStakes = await sm.getUserStakes(ref);
    for (let i = 0; i < refStakes.length; i++) {
      if (!refStakes[i].active) continue;
      try {
        const tx = await sm.compoundFor(ref, i);
        await tx.wait();
        console.log(`  ✓ Compounded ${ref.slice(0,10)}... stakeId=${i}`);
      } catch (err: any) {
        console.log(`  ✗ Skip ${ref.slice(0,10)}... stakeId=${i}: ${err.message?.slice(0, 80)}`);
      }
    }
  }

  // Also compound indirect referrals (L2) for deeper team dividends
  for (const ref of refs) {
    const subRefs = await ad.getDirectReferrals(ref);
    for (const subRef of subRefs) {
      const subStakes = await sm.getUserStakes(subRef);
      for (let i = 0; i < subStakes.length; i++) {
        if (!subStakes[i].active) continue;
        try {
          const tx = await sm.compoundFor(subRef, i);
          await tx.wait();
          console.log(`  ✓ Compounded L2 ${subRef.slice(0,10)}... stakeId=${i}`);
        } catch (err: any) {
          console.log(`  ✗ Skip L2 ${subRef.slice(0,10)}... stakeId=${i}: ${err.message?.slice(0, 80)}`);
        }
      }
    }
  }

  // Get user's income after
  const [d2, t2, r2] = await ad.getAllIncome(TARGET_USER);
  console.log("\n--- After ---");
  console.log(`  Direct: $${ethers.formatUnits(d2, 18)}, Team: $${ethers.formatUnits(t2, 18)}, Rank: $${ethers.formatUnits(r2, 18)}`);
  console.log(`\n  Team dividend change: $${ethers.formatUnits(t1, 18)} → $${ethers.formatUnits(t2, 18)}`);
  
  if (t2 > t1) {
    console.log("  ✓ Team dividends are now being generated!");
  } else {
    console.log("  ✗ Still no team dividends — further investigation needed");
  }
}

main().catch(console.error);
