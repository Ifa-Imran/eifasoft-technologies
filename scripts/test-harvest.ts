import { ethers } from "hardhat";

async function main() {
  const SM_ADDR = "0x9d48b6C43fC858767b451De5Efa2ed1089bf3d1a";
  const AD_ADDR = "0xc1e192AaCd196AE277f45c35Df98674e098CB393";
  const L1_KEY = "edea0b8af9080af0e04a95a59e68b5236fb9ebd911833bda712ea709a0348a38";
  
  const provider = ethers.provider;
  const l1 = new ethers.Wallet(L1_KEY, provider);
  console.log("L1 address:", l1.address);

  const sm = await ethers.getContractAt("StakingManager", SM_ADDR, l1);
  const ad = await ethers.getContractAt("AffiliateDistributor", AD_ADDR, l1);

  // Check stake state
  const stakes = await sm.getUserStakes(l1.address);
  console.log("Stake count:", stakes.length);
  for (let i = 0; i < stakes.length; i++) {
    const s = stakes[i];
    console.log(`  [${i}] active=${s.active} tier=${s.tier} amount=${ethers.formatUnits(s.amount, 18)} compoundEarned=${ethers.formatUnits(s.compoundEarned, 18)} harvestedRewards=${ethers.formatUnits(s.harvestedRewards, 18)}`);
    const available = s.compoundEarned - s.harvestedRewards;
    console.log(`       harvestable=${ethers.formatUnits(available, 18)}`);
  }

  // Try compound first, then harvest - simulating what harvestTier does
  if (stakes.length > 0 && stakes[0].active) {
    // Try compound
    console.log("\n--- Trying compound(0) ---");
    try {
      const compoundTx = await sm.compound(0);
      const receipt = await compoundTx.wait();
      console.log("Compound success, gas:", receipt?.gasUsed?.toString());
    } catch (e: any) {
      console.log("Compound error:", e.message?.substring(0, 300));
    }

    // Re-read stake
    const s = await sm.userStakes(l1.address, 0);
    const available = s.compoundEarned - s.harvestedRewards;
    console.log("After compound harvestable:", ethers.formatUnits(available, 18));

    if (available > 0n) {
      console.log("\n--- Trying harvest(0, available) ---");
      try {
        const harvestTx = await sm.harvest(0, available);
        const receipt = await harvestTx.wait();
        console.log("Harvest success, gas:", receipt?.gasUsed?.toString());
      } catch (e: any) {
        console.log("Harvest error:", e.message?.substring(0, 500));
      }
    }
  }

  // Also try affiliate harvest
  console.log("\n--- Trying AD.harvest(0) [direct income] ---");
  try {
    const tx = await ad.harvest(0);
    const receipt = await tx.wait();
    console.log("AD harvest(0) success, gas:", receipt?.gasUsed?.toString());
  } catch (e: any) {
    console.log("AD harvest(0) error:", e.message?.substring(0, 500));
  }
}

main().catch(console.error);
