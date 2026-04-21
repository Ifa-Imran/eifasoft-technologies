import { ethers } from "hardhat";

async function main() {
  const SM_ADDR = "0x35F95D1cC8933596d7B3fcc4328D1E1d39Def8F5";
  const NEW_AD  = "0x69Fe3f1c1D347412dAf7835C2eA490d12b964d69";

  const sm = await ethers.getContractAt("StakingManager", SM_ADDR);
  console.log("current AD:", await sm.affiliateDistributor());

  const tx = await sm.setAffiliateDistributor(NEW_AD);
  await tx.wait();
  console.log("updated AD:", await sm.affiliateDistributor());
}

main().catch(console.error);
