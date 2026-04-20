import { ethers } from "hardhat";

async function main() {
  const SM_ADDR = "0x90bce7aCB3429BEF9cE52E9594A90DE69DAad191";
  const NEW_AD  = "0x27CAc5ffcaDCdB2f7DafaE58Dfd1dEb1C51087CB";

  const sm = await ethers.getContractAt("StakingManager", SM_ADDR);
  console.log("current AD:", await sm.affiliateDistributor());

  const tx = await sm.setAffiliateDistributor(NEW_AD);
  await tx.wait();
  console.log("updated AD:", await sm.affiliateDistributor());
}

main().catch(console.error);
