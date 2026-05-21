import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed personal & team volumes on the new AffiliateDistributor for every
 * snapshot user with non-zero migrated principal.
 *
 * Per-user amount formula (matches scripts/seed-from-snapshot.ts):
 *   activeOriginalSum + subscriptionCount * 10 USDT (CMS_PRICE)
 *
 * For each user with amount > 0, calls:
 *   AffiliateDistributor.addTeamVolume(user, amount)
 *
 * The contract method:
 *   - increments personalVolume[user] by amount
 *   - walks up referrer chain, adding amount to each upline's teamVolume
 *   - auto-syncs each upline's rank via _accrueAndSyncRank
 *
 * Required env: AFFILIATE_DISTRIBUTOR_ADDRESS  (the NEW AffiliateDistributor)
 * Optional env: SNAPSHOT_FILE, DRY_RUN, START_INDEX, MAX_USERS
 *
 * Run: npx hardhat run scripts/seed-team-volumes.ts --network opbnbTestnet
 */

const NEW_AD = process.env.AFFILIATE_DISTRIBUTOR_ADDRESS || "";
const SNAPSHOT_FILE = process.env.SNAPSHOT_FILE || "";
const DRY_RUN = process.env.DRY_RUN === "true";
const RESET = process.env.RESET === "true"; // call removeTeamVolume to undo a prior seed
const START_INDEX = Number(process.env.START_INDEX || "0");
const MAX_USERS = Number(process.env.MAX_USERS || "0"); // 0 = no limit
const TX_DELAY_MS = Number(process.env.TX_DELAY_MS || "500");

const CMS_PRICE = ethers.parseUnits("10", 18);

interface SnapshotUser {
  user: string;
  staking: { derived: { activeOriginalSum: string } };
  cms: { subscriptionCount: string };
  affiliate?: { referrer?: string };
}

interface Snapshot {
  meta: { network?: { chainId?: string }; block?: { number?: number } };
  users: SnapshotUser[];
}

function requireAddress(name: string, value: string) {
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${name} is not set or not a valid address. Got: ${value}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  requireAddress("AFFILIATE_DISTRIBUTOR_ADDRESS", NEW_AD);

  const snapshotPath = SNAPSHOT_FILE || path.join(__dirname, "..", "backups", "snapshot.json");
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot file not found: ${snapshotPath}`);
  }

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=== seed-team-volumes ===");
  console.log("  signer                :", signer.address);
  console.log("  network               :", network.name, `(chainId ${network.chainId})`);
  console.log("  AffiliateDistributor  :", NEW_AD);
  console.log("  snapshot file         :", snapshotPath);
  console.log("  dry run               :", DRY_RUN);
  console.log("  reset mode            :", RESET);
  console.log("  start index           :", START_INDEX);
  console.log("  max users             :", MAX_USERS || "(no limit)");

  const raw = fs.readFileSync(snapshotPath, "utf8");
  const snap: Snapshot = JSON.parse(raw);
  if (!Array.isArray(snap.users)) {
    throw new Error("Invalid snapshot: missing users[] array");
  }
  console.log(`Loaded snapshot: ${snap.users.length} users`);

  // Build the seed list: same formula as seed-from-snapshot.ts
  type Row = { user: string; finalPrincipal: bigint };
  const all: Row[] = [];
  let zeroCount = 0;
  let invalidCount = 0;
  for (const u of snap.users) {
    const addr = (u.user || "").toLowerCase();
    if (!ethers.isAddress(addr)) { invalidCount++; continue; }
    const oldPrincipal = BigInt(u.staking?.derived?.activeOriginalSum || "0");
    const subCount = BigInt(u.cms?.subscriptionCount || "0");
    const final = oldPrincipal + subCount * CMS_PRICE;
    if (final === 0n) { zeroCount++; continue; }
    all.push({ user: addr, finalPrincipal: final });
  }

  console.log(`  Users with non-zero principal: ${all.length}`);
  console.log(`  Users with zero principal     : ${zeroCount}`);
  console.log(`  Invalid addresses             : ${invalidCount}`);

  // Apply START_INDEX / MAX_USERS slicing for resume support
  let toSeed = all.slice(START_INDEX);
  if (MAX_USERS > 0) toSeed = toSeed.slice(0, MAX_USERS);

  const totalAmount = toSeed.reduce((acc, r) => acc + r.finalPrincipal, 0n);
  console.log(`  Will seed: ${toSeed.length} users, total = ${ethers.formatUnits(totalAmount, 18)} USD`);

  // Audit CSV
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const csvPath = path.join(outDir, `seed-team-volumes-${network.chainId}-${stamp}.csv`);
  const header = "index,user,amountUsd,txHash,status\n";
  fs.writeFileSync(csvPath, header);
  console.log(`Audit CSV: ${csvPath}`);

  if (toSeed.length === 0) {
    console.log("Nothing to seed. Exiting.");
    return;
  }

  const ad = await ethers.getContractAt("AffiliateDistributor", NEW_AD);
  const STAKING_ROLE = await ad.STAKING_ROLE();
  const hasRole: boolean = await ad.hasRole(STAKING_ROLE, signer.address);
  console.log(`  signer has STAKING_ROLE: ${hasRole}`);
  if (!hasRole && !DRY_RUN) {
    throw new Error("Signer lacks STAKING_ROLE on AffiliateDistributor — cannot call addTeamVolume");
  }

  if (DRY_RUN) {
    console.log("DRY_RUN=true — skipping transactions.");
    // Still write a preview CSV
    for (let i = 0; i < toSeed.length; i++) {
      const r = toSeed[i];
      fs.appendFileSync(csvPath, `${START_INDEX + i},${r.user},${ethers.formatUnits(r.finalPrincipal, 18)},,DRY_RUN\n`);
    }
    return;
  }

  let ok = 0;
  let failed = 0;
  const method = RESET ? "removeTeamVolume" : "addTeamVolume";
  console.log(`Calling ${method} for ${toSeed.length} users...`);
  for (let i = 0; i < toSeed.length; i++) {
    const r = toSeed[i];
    const idx = START_INDEX + i;
    const amountStr = ethers.formatUnits(r.finalPrincipal, 18);
    try {
      const tx = RESET
        ? await ad.removeTeamVolume(r.user, r.finalPrincipal)
        : await ad.addTeamVolume(r.user, r.finalPrincipal);
      const receipt = await tx.wait();
      const hash = receipt?.hash || "";
      const sign = RESET ? "-" : "+";
      console.log(`  [${idx + 1}/${all.length}] ${r.user}  ${sign}$${amountStr}  tx=${hash}`);
      fs.appendFileSync(csvPath, `${idx},${r.user},${amountStr},${hash},OK\n`);
      ok++;
      if (TX_DELAY_MS > 0) await sleep(TX_DELAY_MS);
    } catch (err: any) {
      const msg = (err?.shortMessage || err?.message || String(err)).split("\n")[0];
      console.error(`  [${idx + 1}/${all.length}] ${r.user}  FAILED: ${msg}`);
      fs.appendFileSync(csvPath, `${idx},${r.user},${amountStr},,FAIL: ${msg.replace(/,/g, ";")}\n`);
      failed++;
    }
  }

  console.log("");
  console.log(`Done. ok=${ok}, failed=${failed}, total=${toSeed.length}`);
  console.log(`Audit CSV: ${csvPath}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
