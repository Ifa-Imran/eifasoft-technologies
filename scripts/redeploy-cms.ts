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

  // Existing contract addresses (v19)
  const KAIRO_TOKEN     = "0x7dF1602A21F7995e9A25D4772EDdF74d7dBD43Bd";
  const USDT            = "0x60F3FD181DbeC9e201e383355Fde953899c0e489";
  const LIQUIDITY_POOL  = "0xb734654Dc144F0a68281F10B0aDF911814678558";
  const STAKING_MANAGER = "0x35F95D1cC8933596d7B3fcc4328D1E1d39Def8F5";
  const AFFILIATE       = "0x69Fe3f1c1D347412dAf7835C2eA490d12b964d69";
  const SYSTEM_WALLET   = "0x624D0985D844Cd1DF132723a9d849FE1A34cAf9D";

  // 1. Deploy new CMS
  console.log("\n1. Deploying new CoreMembershipSubscription...");
  const CMS = await ethers.getContractFactory("CoreMembershipSubscription");

  // Testing deadlines: 3 hours subscribe, 6 hours claim from current block
  const latestBlock = await ethers.provider.getBlock("latest");
  const now = latestBlock!.timestamp;
  const SUBSCRIBE_DEADLINE = now + 3 * 60 * 60;  // +3 hours
  const CLAIM_DEADLINE = now + 6 * 60 * 60;      // +6 hours
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
