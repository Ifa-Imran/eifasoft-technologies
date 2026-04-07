import { ethers } from "hardhat";

async function main() {
  const STAKING_MANAGER = "0x964DADB4cFD90BC01A1a64387a5B24b748F34bC1";
  const CMS_ADDRESS = "0x9d91b01e4A82BA3c9d38D1E3F9F9c804259A2c7e";

  const stakingManager = await ethers.getContractAt("StakingManager", STAKING_MANAGER);

  console.log("Setting CMS on StakingManager...");
  const tx = await stakingManager.setCMS(CMS_ADDRESS);
  await tx.wait();
  console.log("Done! CMS set to:", CMS_ADDRESS);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
