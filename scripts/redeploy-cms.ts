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

  // Existing contract addresses (v26)
  const KAIRO_TOKEN     = "0x1446129c731e7984be98db89D53e6dD370349451";
  const USDT            = "0xD0716dCB53833fCb82Ecb838858D44935f8680F3";
  const LIQUIDITY_POOL  = "0xeb7099db8BDb0AD6f077bcfCfD48F23fBeC05eC4";
  const STAKING_MANAGER = "0xF64866657604B200CB3BA4f2E39Cd51738024934";
  const AFFILIATE       = "0xCF8A33d0E2BcB1492E396B0B3eA0678455e79AB1";
  const SYSTEM_WALLET   = "0x624D0985D844Cd1DF132723a9d849FE1A34cAf9D";

  // 1. Deploy new CMS
  console.log("\n1. Deploying new CoreMembershipSubscription...");
  const CMS = await ethers.getContractFactory("CoreMembershipSubscription");

  // Production deadlines (fixed calendar dates, UTC midnight)
  const SUBSCRIBE_DEADLINE = Math.floor(new Date("2026-05-16T00:00:00Z").getTime() / 1000);
  const CLAIM_DEADLINE = Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000);
  console.log("   Subscribe deadline:", new Date(SUBSCRIBE_DEADLINE * 1000).toUTCString());
  console.log("   Claim deadline:", new Date(CLAIM_DEADLINE * 1000).toUTCString());

  const cms = await CMS.deploy(
    KAIRO_TOKEN, USDT, LIQUIDITY_POOL, STAKING_MANAGER, AFFILIATE, SYSTEM_WALLET, deployer.address,
    SUBSCRIBE_DEADLINE, CLAIM_DEADLINE
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
