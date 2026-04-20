import { ethers } from "hardhat";

async function main() {
  const SM_ADDR = "0x9d48b6C43fC858767b451De5Efa2ed1089bf3d1a";
  const NEW_AD  = "0xc1e192AaCd196AE277f45c35Df98674e098CB393";

  const sm = await ethers.getContractAt("StakingManager", SM_ADDR);
  console.log("current AD:", await sm.affiliateDistributor());

  const tx = await sm.setAffiliateDistributor(NEW_AD);
  await tx.wait();
  console.log("updated AD:", await sm.affiliateDistributor());
}

main().catch(console.error);
