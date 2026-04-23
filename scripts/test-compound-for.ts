/**
 * test-compound-for.ts — Trigger compoundAllFor to test team dividend generation
 * Usage: npx hardhat run scripts/test-compound-for.ts --network opbnbTestnet
 */
import { ethers } from "hardhat";

const STAKING_MANAGER = "0xcb566fc10C94C2AC38FF94fa803AC3a9f4478181";
const AFFILIATE_DISTRIBUTOR = "0x450A9ec91B85A6FfC71109fBd855b16f54da4472";
const TARGET_USER = "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA";

async function main() {
  const [deployer] = await ethers.getSigners();
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);

  // Check team dividend BEFORE
  const [, teamBefore] = await ad.getAllIncome(TARGET_USER);
  console.log(`Team dividend BEFORE: $${ethers.formatUnits(teamBefore, 18)}`);

  // Check referrals' compound earned BEFORE
  const refs = await ad.getDirectReferrals(TARGET_USER);
  for (const ref of refs) {
    const stakes = await sm.getUserStakes(ref);
    for (let i = 0; i < stakes.length; i++) {
      console.log(`  Ref ${ref} stake#${i} compoundEarned BEFORE: $${ethers.formatUnits(stakes[i].compoundEarned, 18)}`);
    }
  }

  // Call compoundAllFor (permissionless — anyone can call)
  console.log(`\nCalling compoundAllFor(${TARGET_USER})...`);
  const tx = await sm.compoundAllFor(TARGET_USER);
  const receipt = await tx.wait();
  console.log(`TX: ${receipt?.hash}, gas: ${receipt?.gasUsed}`);

  // Check team dividend AFTER
  const [, teamAfter] = await ad.getAllIncome(TARGET_USER);
  console.log(`\nTeam dividend AFTER: $${ethers.formatUnits(teamAfter, 18)}`);

  // Check referrals' compound earned AFTER
  for (const ref of refs) {
    const stakes = await sm.getUserStakes(ref);
    for (let i = 0; i < stakes.length; i++) {
      console.log(`  Ref ${ref} stake#${i} compoundEarned AFTER: $${ethers.formatUnits(stakes[i].compoundEarned, 18)}`);
    }
  }

  // Also check target user's own compound
  const targetStakes = await sm.getUserStakes(TARGET_USER);
  for (let i = 0; i < targetStakes.length; i++) {
    console.log(`  Target stake#${i} compoundEarned: $${ethers.formatUnits(targetStakes[i].compoundEarned, 18)}`);
  }
}

main().catch(console.error);
