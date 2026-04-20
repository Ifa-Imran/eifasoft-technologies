import { ethers } from "hardhat";

async function main() {
  const AD_ADDR = "0x27CAc5ffcaDCdB2f7DafaE58Dfd1dEb1C51087CB";
  const SM_ADDR = "0x90bce7aCB3429BEF9cE52E9594A90DE69DAad191";
  const CMS_ADDR = "0xA2B599B18090309FBc06422d764E292D27609870";
  const KAIRO_ADDR = "0x18f56e007cEe5497dA95f04F50E49cE8ddd0010F";
  const DEPLOYER = "0x624D0985D844Cd1DF132723a9d849FE1A34cAf9D";
  const L1 = "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA";

  const ad = await ethers.getContractAt("AffiliateDistributor", AD_ADDR);
  const sm = await ethers.getContractAt("StakingManager", SM_ADDR);
  const kairo = await ethers.getContractAt("KAIROToken", KAIRO_ADDR);

  // Check roles
  const STAKING_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STAKING_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const CORE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("CORE_ROLE"));

  console.log("=== Role checks ===");
  console.log("SM has STAKING_ROLE on AD:", await ad.hasRole(STAKING_ROLE, SM_ADDR));
  console.log("SM has MINTER_ROLE on KAIRO:", await kairo.hasRole(MINTER_ROLE, SM_ADDR));
  console.log("AD has MINTER_ROLE on KAIRO:", await kairo.hasRole(MINTER_ROLE, AD_ADDR));
  console.log("CMS has MINTER_ROLE on KAIRO:", await kairo.hasRole(MINTER_ROLE, CMS_ADDR));

  console.log("\n=== Address links ===");
  console.log("AD.stakingManager:", await ad.stakingManager());
  console.log("SM.affiliateDistributor:", await sm.affiliateDistributor());
  console.log("SM.cmsContract:", await sm.cmsContract());

  console.log("\n=== Deployer state ===");
  const deployerIncome = await ad.getAllIncome(DEPLOYER);
  console.log("Deployer getAllIncome:", deployerIncome.map((x: bigint) => ethers.formatUnits(x, 18)));
  console.log("Deployer hasActivePosition:", await sm.hasActivePosition(DEPLOYER));
  console.log("Deployer totalActiveStake:", ethers.formatUnits(await sm.getTotalActiveStakeValue(DEPLOYER), 18));

  console.log("\n=== L1 state ===");
  const l1Income = await ad.getAllIncome(L1);
  console.log("L1 getAllIncome:", l1Income.map((x: bigint) => ethers.formatUnits(x, 18)));
  console.log("L1 hasActivePosition:", await sm.hasActivePosition(L1));
  console.log("L1 totalActiveStake:", ethers.formatUnits(await sm.getTotalActiveStakeValue(L1), 18));
  
  // Check L1 stakes
  const stakeCount = await sm.getStakeCount(L1);
  console.log("L1 stakeCount:", stakeCount.toString());
  for (let i = 0; i < Number(stakeCount); i++) {
    const stk = await sm.userStakes(L1, i);
    console.log(`  Stake[${i}]: active=${stk.active} amount=${ethers.formatUnits(stk.amount, 18)} compoundEarned=${ethers.formatUnits(stk.compoundEarned, 18)} harvestable=${ethers.formatUnits(stk.compoundEarned - stk.harvestedRewards, 18)}`);
  }
}

main().catch(console.error);
