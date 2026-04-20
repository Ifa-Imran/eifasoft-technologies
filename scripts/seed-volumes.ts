import { ethers } from "hardhat";

/**
 * Seed team volumes on the new AffiliateDistributor and verify
 * that rank auto-syncs automatically (no manual checkRankChange needed).
 *
 * Usage: npx hardhat run scripts/seed-volumes.ts --network opbnbTestnet
 */

const AFFILIATE_DISTRIBUTOR = "0xc1e192AaCd196AE277f45c35Df98674e098CB393";
const STAKING_MANAGER = "0x9d48b6C43fC858767b451De5Efa2ed1089bf3d1a";

const L1 = "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA";
const L2 = "0x65FB5FB2DCf452507264FbED3f73643F7222270A";

const DELAY = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitTx(tx: any) {
  const receipt = await tx.wait();
  await sleep(DELAY);
  return receipt;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);

  console.log("=== Seed Team Volumes on New AD ===\n");

  // Read existing stake values from StakingManager
  const l1Stake = await sm.getTotalActiveStakeValue(L1);
  const l2Stake = await sm.getTotalActiveStakeValue(L2);
  console.log("L1 active stake:", ethers.formatEther(l1Stake), "USD");
  console.log("L2 active stake:", ethers.formatEther(l2Stake), "USD");

  // Check current state on new AD
  const l1VolBefore = await ad.teamVolume(L1);
  const genesisVolBefore = await ad.teamVolume(deployer.address);
  console.log("\nBefore seeding:");
  console.log("  L1 teamVolume:", ethers.formatEther(l1VolBefore));
  console.log("  Genesis teamVolume:", ethers.formatEther(genesisVolBefore));

  // Check rank before
  const rankBefore = await ad.getUserRankInfo(L1);
  console.log("  L1 storedRank:", rankBefore[0].toString(), "liveRank:", rankBefore[1].toString());

  // Seed: simulate L2's stake propagation (L2 staked -> L1 and Genesis get volume)
  // deployer has STAKING_ROLE so can call addTeamVolume
  console.log("\n--- Seeding L2 stake volume ($111,000 to trigger Rank 3) ---");
  // We'll seed enough to trigger Rank 3 (Director) = $100K threshold
  const seedAmount = ethers.parseEther("111000");

  let tx = await ad.addTeamVolume(L2, seedAmount);
  await waitTx(tx);
  console.log("  addTeamVolume(L2, $111,000) done");

  // Check state after
  const l1VolAfter = await ad.teamVolume(L1);
  const genesisVolAfter = await ad.teamVolume(deployer.address);
  console.log("\nAfter seeding:");
  console.log("  L1 teamVolume:", ethers.formatEther(l1VolAfter));
  console.log("  Genesis teamVolume:", ethers.formatEther(genesisVolAfter));

  // THE KEY CHECK: rank should have auto-synced without calling checkRankChange()
  const rankAfter = await ad.getUserRankInfo(L1);
  console.log("\n=== RANK AUTO-SYNC VERIFICATION ===");
  console.log("  L1 storedRank:", rankAfter[0].toString());
  console.log("  L1 liveRank:  ", rankAfter[1].toString());
  console.log("  L1 salary:    ", ethers.formatEther(rankAfter[2]), "USD/period");
  console.log("  L1 lastClaim: ", rankAfter[3].toString());
  console.log("  L1 pending:   ", ethers.formatEther(rankAfter[5]), "USD");

  if (rankAfter[0] > 0n && rankAfter[3] > 0n) {
    console.log("\n  ✅ SUCCESS: Rank auto-synced! storedRank is set and timer started.");
    console.log("     No manual checkRankChange() was needed.");
    console.log("     Salary will auto-accrue every hour (testing interval).");
  } else {
    console.log("\n  ❌ FAILED: Rank did NOT auto-sync.");
  }

  // Also check genesis
  const genesisRank = await ad.getUserRankInfo(deployer.address);
  console.log("\n  Genesis storedRank:", genesisRank[0].toString(), "liveRank:", genesisRank[1].toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
