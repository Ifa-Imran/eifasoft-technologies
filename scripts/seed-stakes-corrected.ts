import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Top-up / seed migrated stakes from backups/corrected-seed-data.json.
 *
 * Source of truth: corrected-seed-data.json
 *   - Each user has totalPrincipalRaw = activeOriginal (Stake) + subscriptionCount * 10 USDT (CMS)
 *
 * For each eligible user (totalPrincipalRaw > 0):
 *   target  = totalPrincipalRaw
 *   current = stakingManager.totalActiveStakeValue(user)
 *   delta   = target - current
 *   - delta == 0  -> skip (already correct)
 *   - delta  > 0  -> include in migrateStakes batch
 *   - delta  < 0  -> WARN (current > target; never auto-reduce)
 *
 * This brings each user's total active stake to the correct value without
 * needing to redeploy StakingManager.
 *
 * Required env: STAKING_MANAGER_ADDRESS
 * Optional env: SEED_FILE, BATCH_SIZE, DRY_RUN, SKIP_FINALIZE, INCLUDE_DEPLOYER
 *
 * Run: npx hardhat run scripts/seed-stakes-corrected.ts --network opbnbTestnet
 */

const NEW_STAKING = process.env.STAKING_MANAGER_ADDRESS || "";
const SEED_FILE =
  process.env.SEED_FILE ||
  path.join(__dirname, "..", "backups", "corrected-seed-data.json");
const BATCH_SIZE = Number(process.env.BATCH_SIZE || "100");
const DRY_RUN = process.env.DRY_RUN === "true";
const SKIP_FINALIZE = process.env.SKIP_FINALIZE === "true";
const INCLUDE_DEPLOYER = process.env.INCLUDE_DEPLOYER === "true";

interface SeedUser {
  user: string;
  subscriptionCount: number;
  cmsValueUsdt: string;
  activeOriginalUsdt: string;
  totalPrincipalUsdt: string;
  totalPrincipalRaw: string;
}

interface SeedFile {
  generatedAt?: string;
  network?: any;
  summary?: any;
  users: SeedUser[];
}

async function main() {
  if (!ethers.isAddress(NEW_STAKING)) {
    throw new Error(
      `STAKING_MANAGER_ADDRESS missing/invalid. Got: ${NEW_STAKING}`
    );
  }
  if (!fs.existsSync(SEED_FILE)) {
    throw new Error(`Seed file not found: ${SEED_FILE}`);
  }

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=== seed-stakes-corrected ===");
  console.log("  signer            :", signer.address);
  console.log("  network           :", network.name, `(chainId ${network.chainId})`);
  console.log("  StakingManager    :", NEW_STAKING);
  console.log("  seed file         :", SEED_FILE);
  console.log("  batch size        :", BATCH_SIZE);
  console.log("  dry run           :", DRY_RUN);
  console.log("  skip finalize     :", SKIP_FINALIZE);
  console.log("  include deployer  :", INCLUDE_DEPLOYER);

  const data: SeedFile = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  if (!Array.isArray(data.users)) throw new Error("Invalid seed file: users[] missing");
  console.log(`Loaded ${data.users.length} users from seed file`);

  const sm = await ethers.getContractAt("StakingManager", NEW_STAKING);
  const finalized: boolean = await sm.migrationFinalized();
  if (finalized) {
    throw new Error("StakingManager: migration already finalized — aborting");
  }
  const DEFAULT_ADMIN_ROLE = await sm.DEFAULT_ADMIN_ROLE();
  const hasAdmin: boolean = await sm.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  if (!hasAdmin && !DRY_RUN) {
    throw new Error("Signer lacks DEFAULT_ADMIN_ROLE on StakingManager");
  }

  const deployerLower = signer.address.toLowerCase();

  const rows: {
    user: string;
    target: bigint;
    current: bigint;
    delta: bigint;
    action: "send" | "skip-zero" | "skip-already-correct" | "skip-deployer" | "warn-current-exceeds-target";
  }[] = [];

  console.log("Reading on-chain totalActiveStakeValue for all users...");
  let scanned = 0;
  for (const u of data.users) {
    const addr = (u.user || "").toLowerCase();
    if (!ethers.isAddress(addr)) continue;
    const target = BigInt(u.totalPrincipalRaw || "0");

    if (target === 0n) {
      rows.push({ user: addr, target: 0n, current: 0n, delta: 0n, action: "skip-zero" });
      continue;
    }
    if (!INCLUDE_DEPLOYER && addr === deployerLower) {
      rows.push({ user: addr, target, current: 0n, delta: 0n, action: "skip-deployer" });
      continue;
    }
    const current: bigint = await sm.totalActiveStakeValue(addr);
    let delta = target - current;

    let action: typeof rows[number]["action"];
    if (delta === 0n) action = "skip-already-correct";
    else if (delta < 0n) {
      action = "warn-current-exceeds-target";
      delta = 0n;
    } else {
      action = "send";
    }

    rows.push({ user: addr, target, current, delta, action });
    scanned++;
    if (scanned % 25 === 0) {
      console.log(`  scanned ${scanned}/${data.users.length}`);
    }
  }

  // Audit CSV
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(
    outDir,
    `seed-corrected-report-${network.chainId}-${stamp}.csv`
  );
  const header = "user,targetUsd,currentUsd,deltaUsd,action\n";
  const body = rows
    .map(
      (r) =>
        `${r.user},${ethers.formatUnits(r.target, 18)},${ethers.formatUnits(
          r.current,
          18
        )},${ethers.formatUnits(r.delta, 18)},${r.action}`
    )
    .join("\n");
  fs.writeFileSync(csvPath, header + body + "\n");
  console.log(`Audit CSV written: ${csvPath}`);

  const counters = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.action] = (acc[r.action] || 0) + 1;
    return acc;
  }, {});
  console.log("Action counts:", counters);

  const toSend = rows.filter((r) => r.action === "send" && r.delta > 0n);
  const totalDelta = toSend.reduce((acc, r) => acc + r.delta, 0n);
  console.log(`Will send: ${toSend.length} users, total delta = ${ethers.formatUnits(totalDelta, 18)} USDT`);

  // Print warnings
  const warns = rows.filter((r) => r.action === "warn-current-exceeds-target");
  if (warns.length > 0) {
    console.log("\nWARNINGS — on-chain current exceeds target (will NOT reduce):");
    for (const w of warns) {
      console.log(
        `  ${w.user}  target=${ethers.formatUnits(w.target, 18)}  current=${ethers.formatUnits(w.current, 18)}`
      );
    }
  }

  if (toSend.length === 0) {
    console.log("Nothing to send. Exiting.");
    return;
  }

  if (DRY_RUN) {
    console.log("DRY_RUN=true — skipping all transactions.");
    return;
  }

  console.log(`\nSubmitting migrateStakes in batches of ${BATCH_SIZE}...`);
  const totalBatches = Math.ceil(toSend.length / BATCH_SIZE);
  for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
    const batch = toSend.slice(i, i + BATCH_SIZE);
    const addrs = batch.map((b) => b.user);
    const principals = batch.map((b) => b.delta);
    const idx = i / BATCH_SIZE + 1;
    const tx = await sm.migrateStakes(addrs, principals);
    const receipt = await tx.wait();
    console.log(`  batch ${idx}/${totalBatches}: ${batch.length} users, tx=${receipt?.hash}`);
  }

  if (SKIP_FINALIZE) {
    console.log("SKIP_FINALIZE=true — leaving migration unlocked.");
  } else {
    console.log("Finalizing migration...");
    const finTx = await sm.finalizeMigration();
    const finReceipt = await finTx.wait();
    console.log(`Migration finalized. tx=${finReceipt?.hash}`);
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
