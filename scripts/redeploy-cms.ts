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

  // Existing contract addresses (v4)
  const KAIRO_TOKEN     = "0xeD973313E21FF7d6C16a973E981BF35C2DC59733";
  const USDT            = "0xB035a4196D29dAD51dB2e0ce6B0d8c9e02A821F5";
  const LIQUIDITY_POOL  = "0x75AF9151044934892EB256760183d3FD453C4B3B";
  const STAKING_MANAGER = "0x964DADB4cFD90BC01A1a64387a5B24b748F34bC1";
  const AFFILIATE       = "0xd55d08a001497e1F4033B765046b0Ea5FeDA0472";
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
