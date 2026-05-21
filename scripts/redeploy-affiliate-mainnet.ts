import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Redeploy AffiliateDistributor on opBNB mainnet and re-link with existing contracts.
 * CMS is NOT deployed on mainnet.
 *
 * Steps:
 *   1. Deploy new AffiliateDistributor (7-day rank interval)
 *   2. Link StakingManager -> new AD
 *   3. Link new AD -> StakingManager
 *   4. Grant MINTER_ROLE on KAIROToken to new AD
 *   5. Revoke MINTER_ROLE from old AD
 *   6. Bootstrap genesis account (0x24a4...)
 *   7. Save deployment info
 *
 * Run: npx hardhat run scripts/redeploy-affiliate-mainnet.ts --network opbnbMainnet
 */

const DELAY = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitTx(tx: any) {
  const receipt = await tx.wait();
  await sleep(DELAY);
  return receipt;
}

// ---- existing mainnet addresses ----
const KAIRO_TOKEN = "0x8D01409fB9Adc19F5f1Fb7eD47c12D5A88051AeD";
const LIQUIDITY_POOL = "0x26782184F8346832a2e0c84DEe09deFFF23DBf56";
const STAKING_MANAGER = "0x21c22de855e87B2124A50d76f31E79152C977090";
const OLD_AD = "0x4c1359af6C5D8A1c3FFF7cB1cB24B9E04d95A4Ea";
const GENESIS_ACCOUNT = "0x24a4d280f9986D1dcb2547cA0Bdd952F97BF81aa";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("=== Redeploy AffiliateDistributor (Mainnet) ===");
  console.log("Deployer:", deployer.address);
  console.log("Chain:", network.chainId.toString());
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "BNB\n"
  );

  if (network.chainId !== 204n) {
    throw new Error("This script is for opBNB mainnet (chain 204) only!");
  }

  // 1. Deploy new AffiliateDistributor
  console.log("[1/7] Deploying new AffiliateDistributor...");
  const RANK_INTERVAL = 7 * 24 * 60 * 60; // 7 days
  const AD = await ethers.getContractFactory("AffiliateDistributor");
  const ad = await AD.deploy(
    KAIRO_TOKEN,
    LIQUIDITY_POOL,
    deployer.address,
    deployer.address, // systemWallet = deployer
    RANK_INTERVAL
  );
  await ad.waitForDeployment();
  await sleep(DELAY);
  const adAddress = await ad.getAddress();
  console.log("  New AffiliateDistributor:", adAddress);

  // 2. Link StakingManager -> new AD
  console.log("[2/7] Linking StakingManager -> new AD...");
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  let tx = await sm.setAffiliateDistributor(adAddress);
  await waitTx(tx);
  console.log("  Done");

  // 3. Link new AD -> StakingManager
  console.log("[3/7] Linking new AD -> StakingManager...");
  tx = await ad.setStakingManager(STAKING_MANAGER);
  await waitTx(tx);
  console.log("  Done");

  // 4. Grant MINTER_ROLE on KAIROToken to new AD
  console.log("[4/7] Granting MINTER_ROLE on KAIROToken -> new AD...");
  const kairo = await ethers.getContractAt("KAIROToken", KAIRO_TOKEN);
  const MINTER_ROLE = await kairo.MINTER_ROLE();
  tx = await kairo.grantRole(MINTER_ROLE, adAddress);
  await waitTx(tx);
  console.log("  Done");

  // 5. Revoke MINTER_ROLE from old AD
  console.log("[5/7] Revoking MINTER_ROLE from old AD...");
  tx = await kairo.revokeRole(MINTER_ROLE, OLD_AD);
  await waitTx(tx);
  console.log("  Done");

  // 6. Bootstrap genesis account
  console.log("[6/7] Bootstrapping genesis account...");
  const STAKING_ROLE = await ad.STAKING_ROLE();
  tx = await ad.grantRole(STAKING_ROLE, deployer.address);
  await waitTx(tx);
  // First setReferrer call sets genesis
  tx = await ad.setReferrer(GENESIS_ACCOUNT, ethers.ZeroAddress);
  await waitTx(tx);
  const onChainGenesis = await ad.genesisAccount();
  console.log("  Genesis set:", onChainGenesis);

  // 7. Save deployment info
  console.log("[7/7] Saving deployment info...");
  const info = {
    timestamp: new Date().toISOString(),
    chain: network.chainId.toString(),
    deployer: deployer.address,
    oldAffiliateDistributor: OLD_AD,
    newAffiliateDistributor: adAddress,
    genesisAccount: onChainGenesis,
    rankInterval: RANK_INTERVAL,
    existingContracts: {
      kairoToken: KAIRO_TOKEN,
      liquidityPool: LIQUIDITY_POOL,
      stakingManager: STAKING_MANAGER,
    },
  };

  const outPath = path.join(
    __dirname,
    "..",
    "backups",
    `ad-redeploy-mainnet-${network.chainId}-${new Date().toISOString().replace(/:/g, "-")}.json`
  );
  fs.writeFileSync(outPath, JSON.stringify(info, null, 2));
  console.log("  Saved to:", outPath);

  console.log("\n=============================================");
  console.log("Redeployment complete!");
  console.log("=============================================");
  console.log(`\nNew AffiliateDistributor: ${adAddress}`);
  console.log(`\nUpdate your .env files:`);
  console.log(`  NEXT_PUBLIC_AFFILIATE_DISTRIBUTOR=${adAddress}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Seed affiliate tree: AFFILIATE_DISTRIBUTOR=${adAddress} SNAPSHOT_FILE=backups/correct-tree.json npx hardhat run scripts/seed-affiliate-tree.ts --network opbnbMainnet`);
  console.log(`  2. Seed team volumes`);
  console.log(`  3. Update frontend .env.local`);
  console.log(`  4. Revoke STAKING_ROLE from deployer when done`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Redeploy failed:", error);
    process.exit(1);
  });
