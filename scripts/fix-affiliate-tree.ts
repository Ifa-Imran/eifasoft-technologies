import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Re-query the OLD mainnet AffiliateDistributor for the real referrer of every
 * registered user, with retries (no silent zero fallback like the original
 * backup script). Outputs `backups/correct-tree.json`.
 *
 * Run:
 *   npx hardhat run scripts/fix-affiliate-tree.ts --network opbnbMainnet
 */

const OLD_AD = "0xf53C1735e345dEBe19a3168BFE6AA3CC07FdBCD6";
const SNAPSHOT_FILE = path.join(__dirname, "..", "backups", "snapshot.json");
const OUT_FILE = path.join(__dirname, "..", "backups", "correct-tree.json");
const ZERO = ethers.ZeroAddress.toLowerCase();

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 5, label = ""): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const wait = 500 * Math.pow(2, i);
      if (i < retries - 1) {
        console.log(`    retry ${i + 1}/${retries} for ${label} after ${wait}ms: ${err?.message?.slice(0, 60)}`);
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("=== Fix Affiliate Tree (re-query mainnet AD) ===");
  console.log("Network :", network.name, `(chainId ${network.chainId})`);
  console.log("Old AD  :", OLD_AD);

  if (network.chainId !== 204n) {
    throw new Error(`Wrong network. Expected opbnbMainnet (204), got ${network.chainId}`);
  }

  const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
  const users: string[] = (snap.users || []).map((u: any) => (u.user || "").toLowerCase()).filter(ethers.isAddress);
  console.log("Users in snapshot:", users.length);

  const ad = await ethers.getContractAt("AffiliateDistributor", OLD_AD);

  // Sanity: get genesisAccount
  const genesis = (await ad.genesisAccount()).toLowerCase();
  console.log("Genesis account  :", genesis);

  // Query referrer for each user with retries
  const result: { user: string; referrer: string }[] = [];
  let zeroCount = 0;
  let realCount = 0;
  let genesisCount = 0;
  let errCount = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      const ref = (await withRetry(() => ad.referrerOf(user), 5, user)).toLowerCase();
      result.push({ user, referrer: ref });
      if (ref === ZERO) zeroCount++;
      else if (ref === user) genesisCount++;
      else realCount++;
    } catch (err: any) {
      console.error(`  ${user}: FAILED -- ${err?.message?.slice(0, 80)}`);
      result.push({ user, referrer: "ERROR" });
      errCount++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  Queried ${i + 1}/${users.length} -- real:${realCount} zero:${zeroCount} genesis:${genesisCount} err:${errCount}`);
    }
    await sleep(50); // gentle pacing
  }

  console.log("\nFinal counts:");
  console.log(`  Total       : ${result.length}`);
  console.log(`  Real upline : ${realCount}`);
  console.log(`  Genesis self: ${genesisCount}`);
  console.log(`  Zero (none) : ${zeroCount}`);
  console.log(`  Errors      : ${errCount}`);

  // Build inverse map (counts per referrer)
  const directs: Record<string, number> = {};
  for (const r of result) {
    if (r.referrer !== ZERO && r.referrer !== "ERROR" && r.referrer !== r.user) {
      directs[r.referrer] = (directs[r.referrer] || 0) + 1;
    }
  }
  const top = Object.entries(directs).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log("\nTop 10 referrers by direct count:");
  for (const [a, c] of top) console.log(`  ${a}: ${c} directs`);

  fs.writeFileSync(OUT_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceContract: OLD_AD,
    network: network.chainId.toString(),
    genesis,
    summary: {
      total: result.length,
      realUpline: realCount,
      genesisSelf: genesisCount,
      zero: zeroCount,
      errors: errCount,
    },
    users: result,
  }, null, 2));
  console.log(`\nSaved: ${OUT_FILE}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
