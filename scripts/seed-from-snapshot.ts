import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed a freshly-deployed v30 StakingManager (testnet) with stake principals
 * replayed from a backup snapshot produced by `scripts/backup-old-contracts.ts`.
 *
 * Per-user finalPrincipal formula (matches scripts/migrate-balances.ts):
 *   activeOriginalSum + subscriptionCount * 10 USDT (CMS_PRICE)
 *
 * Required env: STAKING_MANAGER_ADDRESS  (the NEW StakingManager)
 * Optional env: SNAPSHOT_FILE, BATCH_SIZE, DRY_RUN, SKIP_FINALIZE, INCLUDE_DEPLOYER
 *
 * Run: npx hardhat run scripts/seed-from-snapshot.ts --network opbnbTestnet
 */

const NEW_STAKING = process.env.STAKING_MANAGER_ADDRESS || "";
const SNAPSHOT_FILE = process.env.SNAPSHOT_FILE || "";
const BATCH_SIZE = Number(process.env.BATCH_SIZE || "100");
const DRY_RUN = process.env.DRY_RUN === "true";
const SKIP_FINALIZE = process.env.SKIP_FINALIZE === "true";
const INCLUDE_DEPLOYER = process.env.INCLUDE_DEPLOYER === "true";

const CMS_PRICE = ethers.parseUnits("10", 18);

function requireAddress(name: string, value: string) {
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${name} is not set or not a valid address. Got: ${value}`);
  }
}

function pickLatestBackup(): string {
  const dir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(dir)) {
    throw new Error(`backups/ directory not found at ${dir}`);
  }
  const candidates = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("kairodao-backup-") && f.endsWith(".json"))
    .map((f) => ({ name: f, full: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (candidates.length === 0) {
    throw new Error(`No kairodao-backup-*.json files in ${dir}`);
  }
  return candidates[0].full;
}

interface SnapshotUser {
  user: string;
  staking: { derived: { activeOriginalSum: string } };
  cms: { subscriptionCount: string };
}

interface Snapshot {
  meta: { network?: { chainId?: string }; block?: { number?: number } };
  users: SnapshotUser[];
}

async function main() {
  requireAddress("STAKING_MANAGER_ADDRESS", NEW_STAKING);

  const snapshotPath = SNAPSHOT_FILE || pickLatestBackup();
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot file not found: ${snapshotPath}`);
  }

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=== seed-from-snapshot ===");
  console.log("  signer            :", signer.address);
  console.log("  network           :", network.name, `(chainId ${network.chainId})`);
  console.log("  NEW StakingManager:", NEW_STAKING);
  console.log("  snapshot file     :", snapshotPath);
  console.log("  batch size        :", BATCH_SIZE);
  console.log("  dry run           :", DRY_RUN);
  console.log("  skip finalize     :", SKIP_FINALIZE);
  console.log("  include deployer  :", INCLUDE_DEPLOYER);

  const raw = fs.readFileSync(snapshotPath, "utf8");
  const snap: Snapshot = JSON.parse(raw);
  if (!Array.isArray(snap.users)) {
    throw new Error("Invalid snapshot: missing users[] array");
  }
  console.log(`Loaded snapshot: ${snap.users.length} users`);

  const deployerLower = signer.address.toLowerCase();
  const rows: { user: string; oldPrincipal: bigint; cmsAmount: bigint; finalPrincipal: bigint; skippedReason?: string }[] = [];

  for (const u of snap.users) {
    const addr = (u.user || "").toLowerCase();
    if (!ethers.isAddress(addr)) {
      rows.push({ user: u.user, oldPrincipal: 0n, cmsAmount: 0n, finalPrincipal: 0n, skippedReason: "invalid-address" });
      continue;
    }
    const oldPrincipal = BigInt(u.staking?.derived?.activeOriginalSum || "0");
    const subCount = BigInt(u.cms?.subscriptionCount || "0");
    const cmsAmount = subCount * CMS_PRICE;
    const finalPrincipal = oldPrincipal + cmsAmount;

    let skippedReason: string | undefined;
    if (finalPrincipal === 0n) skippedReason = "zero-principal";
    if (!INCLUDE_DEPLOYER && addr === deployerLower) skippedReason = "is-deployer";

    rows.push({ user: addr, oldPrincipal, cmsAmount, finalPrincipal, skippedReason });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, `seed-report-${network.chainId}-${stamp}.csv`);
  const header = "user,oldPrincipalUsd,cmsAmountUsd,finalPrincipalUsd,skippedReason\n";
  const body = rows
    .map((r) => `${r.user},${ethers.formatUnits(r.oldPrincipal, 18)},${ethers.formatUnits(r.cmsAmount, 18)},${ethers.formatUnits(r.finalPrincipal, 18)},${r.skippedReason ?? ""}`)
    .join("\n");
  fs.writeFileSync(csvPath, header + body + "\n");
  console.log(`Audit CSV written: ${csvPath}`);

  const toSeed = rows.filter((r) => !r.skippedReason);
  const totalPrincipal = toSeed.reduce((acc, r) => acc + r.finalPrincipal, 0n);
  console.log(`Users to seed: ${toSeed.length} / ${rows.length}`);
  console.log(`Total principal: ${ethers.formatUnits(totalPrincipal, 18)} USDT`);

  if (toSeed.length === 0) {
    console.log("Nothing to seed. Exiting.");
    return;
  }

  const newStaking = await ethers.getContractAt("StakingManager", NEW_STAKING);
  const finalized: boolean = await newStaking.migrationFinalized();
  if (finalized) {
    throw new Error("NEW StakingManager: migration already finalized — aborting");
  }

  const DEFAULT_ADMIN_ROLE = await newStaking.DEFAULT_ADMIN_ROLE();
  const hasAdmin: boolean = await newStaking.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  if (!hasAdmin && !DRY_RUN) {
    throw new Error("Signer lacks DEFAULT_ADMIN_ROLE on NEW StakingManager");
  }

  if (DRY_RUN) {
    console.log("DRY_RUN=true — skipping all transactions.");
    return;
  }

  console.log(`Submitting migrateStakes in batches of ${BATCH_SIZE}...`);
  const totalBatches = Math.ceil(toSeed.length / BATCH_SIZE);
  for (let i = 0; i < toSeed.length; i += BATCH_SIZE) {
    const batch = toSeed.slice(i, i + BATCH_SIZE);
    const addrs = batch.map((b) => b.user);
    const principals = batch.map((b) => b.finalPrincipal);
    const idx = i / BATCH_SIZE + 1;
    const tx = await newStaking.migrateStakes(addrs, principals);
    const receipt = await tx.wait();
    console.log(`  batch ${idx}/${totalBatches}: ${batch.length} users, tx=${receipt?.hash}`);
  }

  if (SKIP_FINALIZE) {
    console.log("SKIP_FINALIZE=true — leaving migration unlocked.");
  } else {
    console.log("Finalizing migration...");
    const finTx = await newStaking.finalizeMigration();
    const finReceipt = await finTx.wait();
    console.log(`Migration finalized. tx=${finReceipt?.hash}`);
  }

  console.log("Done.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
