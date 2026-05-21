import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed-only script: calls migrateStakes on the ALREADY-DEPLOYED StakingManager.
 *
 * Use this when the new SM is already deployed and wired, but the seeding
 * step failed (e.g. due to gas limit). Does NOT deploy or rewire anything.
 *
 * Idempotent-ish: skips users that already have an active stake on the new SM.
 *
 * Run:
 *   SKIP_FINALIZE=true npx hardhat run scripts/seed-stakes-only.ts --network opbnbTestnet
 */

const NEW_STAKING_MANAGER = "0x5eADF2F4Ac87EAa2fAA5aBCA74BBab98bC7B843f";
const CORRECTED_SEED_FILE = path.join(__dirname, "..", "backups", "corrected-seed-data.json");
const BATCH_SIZE = Number(process.env.BATCH_SIZE || "40");
const SKIP_FINALIZE = process.env.SKIP_FINALIZE === "true";
const START_INDEX = Number(process.env.START_INDEX || "0");
const DELAY = 3000;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface SeedUser {
  user: string;
  totalPrincipalRaw: string;
  subscriptionCount: number;
  totalPrincipalUsdt: string;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("=== Seed Stakes Only ===");
  console.log("Deployer  :", deployer.address);
  console.log("Network   :", network.name, `(chainId ${network.chainId})`);
  console.log("Target SM :", NEW_STAKING_MANAGER);
  console.log("Batch size:", BATCH_SIZE);
  console.log("Start idx :", START_INDEX);
  console.log("Skip fin. :", SKIP_FINALIZE);

  const sm = await ethers.getContractAt("StakingManager", NEW_STAKING_MANAGER);

  // ── Sanity check: ensure migration is still open ──
  const finalized = await sm.migrationFinalized();
  if (finalized) {
    throw new Error("StakingManager.migrationFinalized=true — cannot seed.");
  }
  const ADMIN = ethers.ZeroHash;
  const isAdmin = await sm.hasRole(ADMIN, deployer.address);
  if (!isAdmin) {
    throw new Error(`Deployer ${deployer.address} is NOT admin on this StakingManager.`);
  }
  console.log("Sanity check: OK (migration open, deployer is admin)");

  // ── Load corrected seed data ──
  const seedFile: { users: SeedUser[] } = JSON.parse(fs.readFileSync(CORRECTED_SEED_FILE, "utf8"));
  const deployerLower = deployer.address.toLowerCase();

  const allCandidates: { user: string; principal: bigint }[] = [];
  for (const u of seedFile.users) {
    const addr = (u.user || "").toLowerCase();
    if (!ethers.isAddress(addr)) continue;
    if (addr === deployerLower) continue;
    const principal = BigInt(u.totalPrincipalRaw || "0");
    if (principal === 0n) continue;
    allCandidates.push({ user: addr, principal });
  }

  console.log(`\nTotal candidates: ${allCandidates.length}`);

  // ── Filter out users who already have an active stake ──
  console.log("Checking on-chain state to skip already-seeded users...");
  const toSeed: { user: string; principal: bigint }[] = [];
  let alreadySeeded = 0;
  for (let i = 0; i < allCandidates.length; i++) {
    const { user, principal } = allCandidates[i];
    try {
      const stake = await sm.stakes(user);
      // Stake struct: principal, ..., active (bool)
      // Use stakerCount / activeFlag to detect existence
      const hasActive = stake.active === true || stake[ "active" as any ] === true;
      if (hasActive) {
        alreadySeeded++;
        continue;
      }
    } catch {
      // ignore — assume not seeded
    }
    toSeed.push({ user, principal });
    if ((i + 1) % 50 === 0) {
      console.log(`  Checked ${i + 1}/${allCandidates.length}...`);
    }
  }

  console.log(`Already seeded: ${alreadySeeded}`);
  console.log(`To seed       : ${toSeed.length}`);
  const totalRemaining = toSeed.reduce((a, b) => a + b.principal, 0n);
  console.log(`Total principal remaining: ${ethers.formatUnits(totalRemaining, 18)} USDT`);

  if (toSeed.length === 0) {
    console.log("\nNothing to seed.");
  } else {
    const sliced = toSeed.slice(START_INDEX);
    const batches = Math.ceil(sliced.length / BATCH_SIZE);
    console.log(`\nSeeding ${sliced.length} users in ${batches} batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < sliced.length; i += BATCH_SIZE) {
      const batch = sliced.slice(i, i + BATCH_SIZE);
      const addrs = batch.map(b => b.user);
      const principals = batch.map(b => b.principal);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      try {
        const tx = await sm.migrateStakes(addrs, principals);
        const receipt = await tx.wait();
        console.log(`  Batch ${batchNum}/${batches}: ${batch.length} users — gas: ${receipt?.gasUsed} — tx: ${receipt?.hash}`);
      } catch (err: any) {
        console.error(`  Batch ${batchNum} FAILED: ${err?.message || err}`);
        console.error(`  Resume with: START_INDEX=${START_INDEX + i} BATCH_SIZE=${BATCH_SIZE} npx hardhat run scripts/seed-stakes-only.ts --network opbnbTestnet`);
        throw err;
      }
      await sleep(DELAY);
    }
  }

  // ── Finalize (optional) ──
  if (!SKIP_FINALIZE) {
    console.log("\nFinalizing migration...");
    const tx = await sm.finalizeMigration();
    const receipt = await tx.wait();
    console.log(`  finalizeMigration tx: ${receipt?.hash}`);
  } else {
    console.log("\nMigration left OPEN (SKIP_FINALIZE=true).");
  }

  // ── Verify ──
  const stakerCount = await sm.getStakerCount();
  console.log(`\nFinal staker count on SM: ${stakerCount}`);

  console.log("\n=== DONE ===");
  console.log(`StakingManager: ${NEW_STAKING_MANAGER}`);
  console.log("Update NEXT_PUBLIC_STAKING_MANAGER in frontend/.env and docker-compose.testnet-dev.yml");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
