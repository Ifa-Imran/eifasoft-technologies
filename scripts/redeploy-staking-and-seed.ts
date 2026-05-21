import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Redeploy StakingManager on testnet and seed migrated stakes.
 *
 * Why: the previous StakingManager had `migrationFinalized=true` with 0 stakes.
 * We deploy a fresh one, wire it into the existing ecosystem, then call
 * migrateStakes for every snapshot user that has an active stake OR CMS subs.
 *
 * Existing contracts remain untouched:
 *   KAIROToken, LiquidityPool, AffiliateDistributor, CMS, AtomicP2p
 *   (CMS has no setter — it keeps pointing at the old SM which is fine for
 *   testnet demo since the subscribe/claim deadline has already passed.)
 *
 * Run:
 *   SKIP_FINALIZE=true npx hardhat run scripts/redeploy-staking-and-seed.ts --network opbnbTestnet
 */

const DELAY = 3000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function waitTx(tx: any, label = "") {
  const receipt = await tx.wait();
  if (label) console.log(`  ✓ ${label}: ${receipt?.hash}`);
  await sleep(DELAY);
  return receipt;
}

const EXISTING = {
  kairoToken:            "0x611B2c50E0BCcC99E5632c569431C39983126287",
  liquidityPool:         "0xf8BAd518660f515443D58dF0b56C826e111A443f",
  affiliateDistributor:  "0x530Ade1d4E3E757214E3E2bc0633b973621216F9",
  mockUSDT:              "0xE6eab343b44B1D1Ccd8fFbf545a6e3e2425c7a18",
  atomicP2p:             "0xc54ADF4ECdaE213945557cE24fE3F1318d59203E",
};

const CORRECTED_SEED_FILE = path.join(__dirname, "..", "backups", "corrected-seed-data.json");
const BATCH_SIZE = 40;
const SKIP_FINALIZE = process.env.SKIP_FINALIZE === "true";

interface SeedUser {
  user: string;
  totalPrincipalRaw: string;
  subscriptionCount: number;
  totalPrincipalUsdt: string;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("=== Redeploy StakingManager + Seed Stakes ===");
  console.log("Deployer :", deployer.address);
  console.log("Network  :", network.name, `(chainId ${network.chainId})`);
  console.log("Skip finalize:", SKIP_FINALIZE);

  // ── Verify deployer has admin role on LiquidityPool & AffiliateDistributor ──
  const lp  = await ethers.getContractAt("LiquidityPool", EXISTING.liquidityPool);
  const ad  = await ethers.getContractAt("AffiliateDistributor", EXISTING.affiliateDistributor);
  const kt  = await ethers.getContractAt("KAIROToken", EXISTING.kairoToken);
  const p2p = await ethers.getContractAt("AtomicP2p", EXISTING.atomicP2p);
  const ADMIN = ethers.ZeroHash;
  const MINTER_ROLE = await kt.MINTER_ROLE();

  const [lpAdmin, adAdmin, ktAdmin] = await Promise.all([
    lp.hasRole(ADMIN, deployer.address),
    ad.hasRole(ADMIN, deployer.address),
    kt.hasRole(ADMIN, deployer.address),
  ]);
  if (!lpAdmin || !adAdmin || !ktAdmin) {
    throw new Error(`Deployer missing admin role. LP:${lpAdmin} AD:${adAdmin} KT:${ktAdmin}`);
  }
  console.log("Role check: OK");

  // ── Deploy new StakingManager ─────────────────────────────────────────────
  const daoWallets = [
    // DAOs 1-3: 1% each
    "0x4465f4e53241c118a19d092d2495984f467a01a9",
    "0x3c5bB7A176F2787de0A6Ae73C6Eff4Ff5dD63295",
    "0xe3E3Ca6feD0F6Bd26B1E684854F2B7AFB49b2805",
    // DAOs 4-7: 0.5% each
    "0x20d8cF481f06459FdFEAfF9219AD7a979eE06c32",
    "0xBDAb83d8eb19b0454648Db15897796BCFBB2F9B7",
    "0x12f25959b654F308BC1C5224bC856fCf50529e60",
    "0x7DdD88D53A0FEBee5035C97461fba609880311A5",
  ];
  const devFund = "0x96c01bc3142eFB0379C96ac5157d04cA6ED1d796";

  console.log("\n[1/6] Deploying new StakingManager...");
  const SMFactory = await ethers.getContractFactory("StakingManager");
  const newSM = await SMFactory.deploy(
    EXISTING.kairoToken,
    EXISTING.liquidityPool,
    EXISTING.mockUSDT,
    devFund,
    daoWallets,
    deployer.address
  );
  await newSM.waitForDeployment();
  await sleep(DELAY);
  const newSMAddress = await newSM.getAddress();
  console.log("  New StakingManager:", newSMAddress);

  // Override production tier defaults (8h/6h/5h) with testnet seconds-scale
  // intervals (3min/2min/1min) so demo flows compound visibly.
  console.log("  Overriding tier intervals for testnet (3min/2min/1min)...");
  await waitTx(await newSM.setTier(0, ethers.parseEther("10"), ethers.parseEther("499"), 180, 3), "setTier(0)");
  await waitTx(await newSM.setTier(1, ethers.parseEther("500"), ethers.parseEther("1999"), 120, 4), "setTier(1)");
  await waitTx(await newSM.setTier(2, ethers.parseEther("2000"), ethers.MaxUint256, 60, 4), "setTier(2)");

  // ── Wire AffiliateDistributor ─────────────────────────────────────────────
  console.log("\n[2/6] Wire AffiliateDistributor → new StakingManager...");
  await waitTx(await ad.setStakingManager(newSMAddress), "AD.setStakingManager");

  // ── Set AffiliateDistributor on new SM ────────────────────────────────────
  console.log("\n[3/6] Set AffiliateDistributor on new SM...");
  await waitTx(await newSM.setAffiliateDistributor(EXISTING.affiliateDistributor), "SM.setAffiliateDistributor");

  // ── Grant MINTER_ROLE on KAIROToken ───────────────────────────────────────
  console.log("\n[4/6] Grant MINTER_ROLE to new SM on KAIROToken...");
  await waitTx(await kt.grantRole(MINTER_ROLE, newSMAddress), "KT.grantRole(MINTER, newSM)");

  // ── Grant CORE_ROLE on LiquidityPool & update LP's SM reference ───────────
  console.log("\n[5/6] LiquidityPool: grantCoreRole + setStakingManager...");
  await waitTx(await lp.grantCoreRole(newSMAddress), "LP.grantCoreRole(newSM)");
  await waitTx(await lp.setStakingManager(newSMAddress), "LP.setStakingManager");

  // ── Update AtomicP2p reference ─────────────────────────────────────────────
  console.log("  Updating AtomicP2p...");
  await waitTx(await p2p.setStakingManager(newSMAddress), "P2P.setStakingManager");

  // ── Seed migrated stakes ──────────────────────────────────────────────────
  console.log("\n[6/6] Seeding migrated stakes from corrected seed data...");
  const seedFile: { users: SeedUser[] } = JSON.parse(fs.readFileSync(CORRECTED_SEED_FILE, "utf8"));
  const deployerLower = deployer.address.toLowerCase();

  const toSeed: { user: string; principal: bigint }[] = [];
  for (const u of seedFile.users) {
    const addr = (u.user || "").toLowerCase();
    if (!ethers.isAddress(addr)) continue;
    if (addr === deployerLower) continue; // skip deployer

    const principal = BigInt(u.totalPrincipalRaw || "0");
    if (principal === 0n) continue;

    toSeed.push({ user: addr, principal });
  }

  console.log(`  Users to seed: ${toSeed.length}`);
  const total = toSeed.reduce((a, b) => a + b.principal, 0n);
  console.log(`  Total principal: ${ethers.formatUnits(total, 18)} USDT`);

  const batches = Math.ceil(toSeed.length / BATCH_SIZE);
  for (let i = 0; i < toSeed.length; i += BATCH_SIZE) {
    const batch = toSeed.slice(i, i + BATCH_SIZE);
    const addrs = batch.map(b => b.user);
    const principals = batch.map(b => b.principal);
    const batchNum = i / BATCH_SIZE + 1;
    const tx = await newSM.migrateStakes(addrs, principals);
    const receipt = await tx.wait();
    console.log(`  Batch ${batchNum}/${batches}: ${batch.length} users — tx: ${receipt?.hash}`);
    await sleep(DELAY);
  }

  if (!SKIP_FINALIZE) {
    console.log("  Finalizing migration...");
    await waitTx(await newSM.finalizeMigration(), "SM.finalizeMigration");
    console.log("  Migration finalized.");
  } else {
    console.log("  Migration left OPEN (SKIP_FINALIZE=true).");
  }

  // ── Save addresses ─────────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(__dirname, "..", "backups", `sm-redeploy-${network.chainId}-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    network: network.chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    newStakingManager: newSMAddress,
    seededUsers: toSeed.length,
    totalPrincipalUsdt: ethers.formatUnits(total, 18),
  }, null, 2));
  console.log(`\nOutput saved: ${outPath}`);

  console.log("\n=== DONE ===");
  console.log(`NEW STAKING MANAGER: ${newSMAddress}`);
  console.log("Update NEXT_PUBLIC_STAKING_MANAGER in frontend/.env and docker-compose.testnet-dev.yml");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
