import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const addresses = {
    stakingManager: "0xf664bb81902E507424995fDAe182e1dA9019A904",
    affiliateDistributor: "0xeFc8271Abe8a1EADd5c4D7c9903C0D092C2bEF86",
    kairoToken: "0x611B2c50E0BCcC99E5632c569431C39983126287",
    liquidityPool: "0xf8BAd518660f515443D58dF0b56C826e111A443f",
    cms: "0x995B0545677150d8d5Fa6374730FcB4cD400ba88",
  };

  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash; // 0x00...

  const sm = await ethers.getContractAt("StakingManager", addresses.stakingManager);
  const ad = await ethers.getContractAt("AffiliateDistributor", addresses.affiliateDistributor);
  const kt = await ethers.getContractAt("KAIROToken", addresses.kairoToken);
  const lp = await ethers.getContractAt("LiquidityPool", addresses.liquidityPool);
  const cms = await ethers.getContractAt("CoreMembershipSubscription", addresses.cms);

  console.log("\n=== Admin Role Check ===");
  console.log("SM  admin:", await sm.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
  console.log("AD  admin:", await ad.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
  console.log("KT  admin:", await kt.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
  console.log("LP  admin:", await lp.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
  console.log("CMS admin:", await cms.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));

  // Check if AD has STAKING_ROLE for deployer
  const STAKING_ROLE = await ad.STAKING_ROLE();
  console.log("AD  staking_role (deployer):", await ad.hasRole(STAKING_ROLE, deployer.address));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
