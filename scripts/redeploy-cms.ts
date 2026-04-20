import { ethers } from "hardhat";

/**
 * Redeploy ONLY the CMS contract, then reconfigure roles:
 *  - KAIROToken: grant MINTER_ROLE to new CMS
 *  - LiquidityPool: grant CORE_ROLE to new CMS
 *  - StakingManager: setCMS to new CMS address
 *
 * All other contracts remain at their existing addresses.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Existing contract addresses (v18)
  const KAIRO_TOKEN     = "0x7Fee741907649f5a8E105B0e9a70d1dF4B5a5C60";
  const USDT            = "0xcFF16786A3d7f372Fa93D72aF9b27c91e884cEA5";
  const LIQUIDITY_POOL  = "0x62865d26dFf25F1527C9aA962f3BE2828e9cc3Ef";
  const STAKING_MANAGER = "0x9d48b6C43fC858767b451De5Efa2ed1089bf3d1a";
  const AFFILIATE       = "0xc1e192AaCd196AE277f45c35Df98674e098CB393";
  const SYSTEM_WALLET   = "0x624D0985D844Cd1DF132723a9d849FE1A34cAf9D";

  // 1. Deploy new CMS
  console.log("\n1. Deploying new CoreMembershipSubscription...");
  const CMS = await ethers.getContractFactory("CoreMembershipSubscription");
  const cms = await CMS.deploy(
    KAIRO_TOKEN, USDT, LIQUIDITY_POOL, STAKING_MANAGER, AFFILIATE, SYSTEM_WALLET, deployer.address
  );
  await cms.waitForDeployment();
  const cmsAddress = await cms.getAddress();
  console.log("   New CMS deployed at:", cmsAddress);

  // 2. Grant MINTER_ROLE to new CMS on KAIROToken
  console.log("\n2. Granting MINTER_ROLE to new CMS on KAIROToken...");
  const kairo = await ethers.getContractAt("KAIROToken", KAIRO_TOKEN);
  const MINTER_ROLE = await kairo.MINTER_ROLE();
  let tx = await kairo.grantRole(MINTER_ROLE, cmsAddress);
  await tx.wait();
  console.log("   Done");

  // 3. Grant CORE_ROLE to new CMS on LiquidityPool
  console.log("\n3. Granting CORE_ROLE to new CMS on LiquidityPool...");
  const lp = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL);
  tx = await lp.grantCoreRole(cmsAddress);
  await tx.wait();
  console.log("   Done");

  // 4. Set new CMS on StakingManager
  console.log("\n4. Setting new CMS on StakingManager...");
  const staking = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  tx = await staking.setCMS(cmsAddress);
  await tx.wait();
  console.log("   Done");

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("CMS redeployed successfully!");
  console.log("New CMS address:", cmsAddress);
  console.log("");
  console.log("Update frontend/.env:");
  console.log(`  NEXT_PUBLIC_CMS=${cmsAddress}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
