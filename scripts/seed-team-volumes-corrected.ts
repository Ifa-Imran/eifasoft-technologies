import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed team volumes from corrected-seed-data.json instead of snapshot.json.
 *
 * The original seed-team-volumes.ts derived principal from the snapshot formula:
 *   activeOriginalSum + subscriptionCount * 10 USDT
 * but the snapshot had incomplete CMS subscription data, resulting in only
 * 30 users being seeded (1,915 USDT) instead of 264 users (28,466.85 USDT).
 *
 * This script:
 *   1. Reads corrected-seed-data.json (totalPrincipalRaw per user)
 *   2. For each user, checks on-chain personalVolume
 *   3. If personalVolume == 0 & totalPrincipalRaw > 0 → addTeamVolume
 *   4. If personalVolume > 0 & matches → skip
 *   5. If personalVolume > 0 & mismatch → removeTeamVolume(old) then addTeamVolume(new)
 *
 * Required env:
 *   AFFILIATE_DISTRIBUTOR_ADDRESS  - the new mainnet AffiliateDistributor
 * Optional env:
 *   CORRECTED_FILE                 - defaults to backups/corrected-seed-data.json
 *   DRY_RUN=true                   - log only, no tx
 *   START_INDEX=N                  - resume from index
 *   TX_DELAY_MS                    - delay between txs (default 300)
 *
 * Run:
 *   npx hardhat run scripts/seed-team-volumes-corrected.ts --network opbnbMainnet
 */

const AD_ADDR = process.env.AFFILIATE_DISTRIBUTOR_ADDRESS || "";
const CORRECTED_FILE =
  process.env.CORRECTED_FILE ||
  path.join(__dirname, "..", "backups", "corrected-seed-data.json");
const DRY_RUN = process.env.DRY_RUN === "true";
const START_INDEX = Number(process.env.START_INDEX || "0");
const TX_DELAY_MS = Number(process.env.TX_DELAY_MS || "300");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CorrectedUser {
  user: string;
  subscriptionCount: number;
  cmsValueUsdt: string;
  activeOriginalUsdt: string;
  totalPrincipalUsdt: string;
  totalPrincipalRaw: string;
}

interface CorrectedData {
  summary: {
    eligibleUsers: number;
    totalPrincipalUsdt: string;
  };
  users: CorrectedUser[];
}

async function main() {
  if (!ethers.isAddress(AD_ADDR)) {
    throw new Error(`AFFILIATE_DISTRIBUTOR_ADDRESS required. Got: ${AD_ADDR}`);
  }
  if (!fs.existsSync(CORRECTED_FILE)) {
    throw new Error(`Corrected data not found: ${CORRECTED_FILE}`);
  }

  const [signer] = await ethers.getSigners();
  const net = await signer.provider!.getNetwork();

  console.log("=== seed-team-volumes-corrected ===");
  console.log("  signer              :", signer.address);
  console.log("  network             :", net.name, `(chainId ${net.chainId})`);
  console.log("  AffiliateDistributor:", AD_ADDR);
  console.log("  corrected file      :", CORRECTED_FILE);
  console.log("  dry run             :", DRY_RUN);
  console.log("  start index         :", START_INDEX);

  const data: CorrectedData = JSON.parse(fs.readFileSync(CORRECTED_FILE, "utf8"));
  console.log(`  eligible users      : ${data.summary.eligibleUsers}`);
  console.log(`  total principal     : ${data.summary.totalPrincipalUsdt} USDT`);

  const ad = await ethers.getContractAt("AffiliateDistributor", AD_ADDR, signer);
  const STAKING_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STAKING_ROLE"));

  // Check / grant STAKING_ROLE
  const hasRole = await ad.hasRole(STAKING_ROLE, signer.address);
  let grantedHere = false;
  if (!hasRole) {
    console.log("Granting STAKING_ROLE to signer...");
    if (!DRY_RUN) {
      const tx = await ad.grantRole(STAKING_ROLE, signer.address);
      await tx.wait();
      grantedHere = true;
      console.log("  granted, tx:", tx.hash);
    }
  } else {
    console.log("  signer already has STAKING_ROLE");
  }

  // Audit CSV
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const csvPath = path.join(
    __dirname, "..", "backups",
    `seed-team-corrected-${net.chainId}-${ts}.csv`
  );
  fs.writeFileSync(csvPath, "index,user,expected,onchain,action,txHash,status\n");

  const users = data.users.slice(START_INDEX);
  let added = 0, corrected = 0, skipped = 0, failed = 0;
  const startedAt = Date.now();

  console.log(`\nProcessing ${users.length} users (from index ${START_INDEX})...`);

  for (let i = 0; i < users.length; i++) {
    const idx = START_INDEX + i;
    const u = users[i];
    const addr = u.user.toLowerCase();
    const expected = BigInt(u.totalPrincipalRaw);
    const expectedStr = ethers.formatUnits(expected, 18);

    if (expected === 0n) {
      skipped++;
      continue;
    }

    // Check current on-chain personalVolume
    let onchain: bigint;
    try {
      onchain = await ad.personalVolume(addr);
    } catch {
      onchain = 0n;
    }

    const onchainStr = ethers.formatUnits(onchain, 18);

    if (onchain === expected) {
      // Already correct
      skipped++;
      fs.appendFileSync(csvPath, `${idx},${addr},${expectedStr},${onchainStr},SKIP,,OK\n`);
      if (i % 50 === 0) {
        console.log(`  [${idx}] ${addr}  vol=${onchainStr}  SKIP (already correct)`);
      }
      continue;
    }

    if (DRY_RUN) {
      const action = onchain > 0n ? "CORRECT" : "ADD";
      console.log(`  [${idx}] ${addr}  onchain=${onchainStr}  expected=${expectedStr}  → ${action} (dry run)`);
      fs.appendFileSync(csvPath, `${idx},${addr},${expectedStr},${onchainStr},${action}_DRY,,DRY\n`);
      if (onchain > 0n) corrected++; else added++;
      continue;
    }

    try {
      // If already has volume but wrong amount, remove first
      if (onchain > 0n) {
        console.log(`  [${idx}] ${addr}  removing old=${onchainStr} ...`);
        const rmTx = await ad.removeTeamVolume(addr, onchain);
        await rmTx.wait();
        console.log(`    removed, tx: ${rmTx.hash}`);
        if (TX_DELAY_MS > 0) await sleep(TX_DELAY_MS);
      }

      // Add correct volume
      const tx = await ad.addTeamVolume(addr, expected);
      const receipt = await tx.wait();
      const hash = receipt?.hash || "";

      const action = onchain > 0n ? "CORRECTED" : "ADDED";
      if (onchain > 0n) corrected++; else added++;

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`  [${idx}] ${addr}  +$${expectedStr}  ${action}  tx=${hash}  (${elapsed}s)`);
      fs.appendFileSync(csvPath, `${idx},${addr},${expectedStr},${onchainStr},${action},${hash},OK\n`);

      if (TX_DELAY_MS > 0) await sleep(TX_DELAY_MS);
    } catch (err: any) {
      failed++;
      const msg = (err?.shortMessage || err?.message || String(err)).split("\n")[0];
      console.error(`  [${idx}] ${addr}  FAIL: ${msg}`);
      fs.appendFileSync(
        csvPath,
        `${idx},${addr},${expectedStr},${onchainStr},FAIL,,${msg.replace(/,/g, ";")}\n`
      );
    }
  }

  console.log("\n=== Results ===");
  console.log(`  added     : ${added}`);
  console.log(`  corrected : ${corrected}`);
  console.log(`  skipped   : ${skipped}`);
  console.log(`  failed    : ${failed}`);
  console.log(`  total     : ${users.length}`);
  console.log(`  audit CSV : ${csvPath}`);

  // Revoke STAKING_ROLE if we granted it
  if (grantedHere && !DRY_RUN) {
    console.log("Revoking STAKING_ROLE from signer...");
    const tx = await ad.revokeRole(STAKING_ROLE, signer.address);
    await tx.wait();
    console.log("  revoked, tx:", tx.hash);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
