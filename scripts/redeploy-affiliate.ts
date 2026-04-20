import { ethers } from "hardhat";

/**
 * Redeploy AffiliateDistributor + CMS and re-link with existing contracts.
 * CMS must be redeployed because its AD reference is set in the constructor.
 *
 * Usage: npx hardhat run scripts/redeploy-affiliate.ts --network opbnbTestnet
 */

const DELAY = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitTx(tx: any) {
  const receipt = await tx.wait();
  await sleep(DELAY);
  return receipt;
}

// ---- existing deployed addresses (opBNB testnet v18) ----
const KAIRO_TOKEN = "0x7Fee741907649f5a8E105B0e9a70d1dF4B5a5C60";
const LIQUIDITY_POOL = "0x62865d26dFf25F1527C9aA962f3BE2828e9cc3Ef";
const STAKING_MANAGER = "0x9d48b6C43fC858767b451De5Efa2ed1089bf3d1a";
const USDT = "0xcFF16786A3d7f372Fa93D72aF9b27c91e884cEA5";
const SYSTEM_WALLET = "0x624D0985D844Cd1DF132723a9d849FE1A34cAf9D";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== Redeploy AffiliateDistributor + CMS ===");
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "BNB\n"
  );

  // 1. Deploy new AffiliateDistributor
  console.log("[1/10] Deploying new AffiliateDistributor...");
  const AD = await ethers.getContractFactory("AffiliateDistributor");
  const ad = await AD.deploy(KAIRO_TOKEN, LIQUIDITY_POOL, deployer.address, SYSTEM_WALLET);
  await ad.waitForDeployment();
  await sleep(DELAY);
  const adAddress = await ad.getAddress();
  console.log("  AffiliateDistributor:", adAddress);

  // 2. Deploy new CMS (needs the new AD address in constructor)
  console.log("[2/10] Deploying new CoreMembershipSubscription...");
  const CMS = await ethers.getContractFactory("CoreMembershipSubscription");
  const cms = await CMS.deploy(
    KAIRO_TOKEN, USDT, LIQUIDITY_POOL, STAKING_MANAGER, adAddress, SYSTEM_WALLET, deployer.address
  );
  await cms.waitForDeployment();
  await sleep(DELAY);
  const cmsAddress = await cms.getAddress();
  console.log("  CMS:", cmsAddress);

  // 3. Link StakingManager -> new AD
  console.log("[3/10] Linking StakingManager -> new AD...");
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  let tx = await sm.setAffiliateDistributor(adAddress);
  await waitTx(tx);
  console.log("  Done");

  // 4. Link new AD -> StakingManager
  console.log("[4/10] Linking new AD -> StakingManager...");
  tx = await ad.setStakingManager(STAKING_MANAGER);
  await waitTx(tx);
  console.log("  Done");

  // 5. Update StakingManager -> new CMS
  console.log("[5/10] Linking StakingManager -> new CMS...");
  tx = await sm.setCMS(cmsAddress);
  await waitTx(tx);
  console.log("  Done");

  // 6. Grant MINTER_ROLE on KAIROToken to new AD + CMS
  console.log("[6/10] Granting MINTER_ROLE on KAIROToken...");
  const kairo = await ethers.getContractAt("KAIROToken", KAIRO_TOKEN);
  const MINTER_ROLE = await kairo.MINTER_ROLE();
  tx = await kairo.grantRole(MINTER_ROLE, adAddress);
  await waitTx(tx);
  console.log("  -> AffiliateDistributor");
  tx = await kairo.grantRole(MINTER_ROLE, cmsAddress);
  await waitTx(tx);
  console.log("  -> CMS");

  // 7. Grant STAKING_ROLE on new AD to CMS
  console.log("[7/10] Granting STAKING_ROLE on AD -> CMS...");
  const STAKING_ROLE = await ad.STAKING_ROLE();
  tx = await ad.grantRole(STAKING_ROLE, cmsAddress);
  await waitTx(tx);
  console.log("  Done");

  // 8. Grant LiquidityPool CORE_ROLE to new CMS
  console.log("[8/10] Granting LiquidityPool CORE_ROLE -> CMS...");
  const lp = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL);
  tx = await lp.grantCoreRole(cmsAddress);
  await waitTx(tx);
  console.log("  Done");

  // 9. Register genesis account on new AD
  console.log("[9/10] Registering genesis account...");
  tx = await ad.grantRole(STAKING_ROLE, deployer.address);
  await waitTx(tx);
  tx = await ad.setReferrer(deployer.address, ethers.ZeroAddress);
  await waitTx(tx);
  console.log("  Genesis:", deployer.address);

  // 10. Grant deployer COMPOUNDER_ROLE on StakingManager (if not already)
  console.log("[10/10] Ensuring deployer has COMPOUNDER_ROLE...");
  const COMPOUNDER_ROLE = await sm.COMPOUNDER_ROLE();
  const hasRole = await sm.hasRole(COMPOUNDER_ROLE, deployer.address);
  if (!hasRole) {
    tx = await sm.grantRole(COMPOUNDER_ROLE, deployer.address);
    await waitTx(tx);
    console.log("  Granted");
  } else {
    console.log("  Already has it");
  }

  console.log("\n=============================================");
  console.log("Redeployment complete!");
  console.log("=============================================");
  console.log(`\nNew AffiliateDistributor: ${adAddress}`);
  console.log(`New CMS:                  ${cmsAddress}`);
  console.log(`\nUpdate your .env files:`);
  console.log(`  NEXT_PUBLIC_AFFILIATE_DISTRIBUTOR=${adAddress}`);
  console.log(`  NEXT_PUBLIC_CMS=${cmsAddress}`);
  console.log(
    "\nNOTE: All referral registrations are reset. Run the L1/L2 setup script again."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Redeploy failed:", error);
    process.exit(1);
  });
