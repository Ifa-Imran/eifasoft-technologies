import { ethers } from "hardhat";

async function main() {
  const SM = "0xf664bb81902E507424995fDAe182e1dA9019A904";
  const sm = await ethers.getContractAt("StakingManager", SM);
  
  const finalized = await sm.migrationFinalized();
  console.log("migrationFinalized:", finalized);
  
  try {
    const staker0 = await sm.allStakers(0);
    console.log("first staker:", staker0);
  } catch {
    console.log("No stakers yet (allStakers[0] reverted)");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
