import { ethers } from "hardhat";

async function main() {
  const WALLET = "0x24a4d280f9986D1dcb2547cA0Bdd952F97BF81aa";
  const CMS_ADDRESS = "0x9d91b01e4A82BA3c9d38D1E3F9F9c804259A2c7e";

  const cms = await ethers.getContractAt("CoreMembershipSubscription", CMS_ADDRESS);

  // Fetch all CMS details for the wallet
  const [
    subscriptionCount,
    loyaltyRewards,
    leadershipRewards,
    hasClaimed,
    referrerOf,
    claimableRewards,
    maxClaimable,
    excessToDelete,
    canClaimResult,
  ] = await Promise.all([
    cms.subscriptionCount(WALLET),
    cms.loyaltyRewards(WALLET),
    cms.leadershipRewards(WALLET),
    cms.hasClaimed(WALLET),
    cms.referrerOf(WALLET),
    cms.getClaimableRewards(WALLET),
    cms.getMaxClaimable(WALLET),
    cms.getExcessToBeDeleted(WALLET),
    cms.canClaim(WALLET),
  ]);

  // Global stats
  const [totalSubs, deadline, remaining] = await Promise.all([
    cms.totalSubscriptions(),
    cms.deadline(),
    cms.getRemainingSubscriptions(),
  ]);

  // REF_REWARDS breakdown
  const refRewards = [];
  for (let i = 0; i < 5; i++) {
    refRewards.push(ethers.formatEther(await cms.REF_REWARDS(i)));
  }

  console.log("=".repeat(60));
  console.log("CMS Details for:", WALLET);
  console.log("=".repeat(60));
  console.log("");
  console.log("--- User Data ---");
  console.log("  Subscription Count:", subscriptionCount.toString());
  console.log("  Loyalty Rewards:   ", ethers.formatEther(loyaltyRewards), "KAIRO");
  console.log("  Leadership Rewards:", ethers.formatEther(leadershipRewards), "KAIRO");
  console.log("  Has Claimed:       ", hasClaimed);
  console.log("  Referrer:          ", referrerOf);
  console.log("");
  console.log("--- Claimable Breakdown ---");
  console.log("  Loyalty:           ", ethers.formatEther(claimableRewards[0]), "KAIRO");
  console.log("  Leadership:        ", ethers.formatEther(claimableRewards[1]), "KAIRO");
  console.log("  Total Available:   ", ethers.formatEther(claimableRewards[2]), "KAIRO");
  console.log("  Max Claimable:     ", ethers.formatEther(maxClaimable), "KAIRO (capped by stake)");
  console.log("  Excess to Delete:  ", ethers.formatEther(excessToDelete), "KAIRO");
  console.log("  Can Claim:         ", canClaimResult[0], "-", canClaimResult[1]);
  console.log("");
  console.log("--- Leadership Bonus Structure (per subscription) ---");
  console.log("  Level 1:", refRewards[0], "KAIRO");
  console.log("  Level 2:", refRewards[1], "KAIRO");
  console.log("  Level 3:", refRewards[2], "KAIRO");
  console.log("  Level 4:", refRewards[3], "KAIRO");
  console.log("  Level 5:", refRewards[4], "KAIRO");
  console.log("  Total per sub:", refRewards.reduce((a, b) => a + Number(b), 0), "KAIRO");
  console.log("");
  console.log("--- Global Stats ---");
  console.log("  Total Subscriptions:", totalSubs.toString());
  console.log("  Remaining:          ", remaining.toString());
  console.log("  Deadline:           ", new Date(Number(deadline) * 1000).toISOString());
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
