import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Re-query the OLD mainnet contracts (CMS + StakingManager) to get correct
 * per-user subscription counts and active stake amounts.
 *
 * The existing snapshot.json has correct user flags (inCmsEvents=247, inAllStakers=150)
 * but per-user values are mostly zero due to timing of the backup.
 *
 * This script queries mainnet directly and produces a corrected seeding data file.
 *
 * Run:
 *   npx hardhat run scripts/fix-snapshot-values.ts --network opbnbMainnet
 */

const SNAPSHOT_FILE = path.join(__dirname, "..", "backups", "snapshot.json");
const OUT_FILE = path.join(__dirname, "..", "backups", "corrected-seed-data.json");

// Old mainnet contract addresses
const OLD_CMS = "0x04Ecd8106bEcd7FFee528F363dD2121343296F2e";
const OLD_STAKING = "0xB6724041A765e0BE0B212dB57Ff317cCEF5A1EDd";

const CMS_PRICE = ethers.parseUnits("10", 18); // $10 per subscription
const CONCURRENCY = 10;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

async function mapConcurrent<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log("=== Fix Snapshot Values (querying mainnet) ===");
  console.log("Network:", network.name, `(chainId ${network.chainId})`);

  if (Number(network.chainId) !== 204) {
    throw new Error("This script must run on opbnbMainnet (chainId 204). Got: " + network.chainId);
  }

  const snap = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
  console.log("Loaded snapshot:", snap.users.length, "users");
  console.log("CMS buyers (inCmsEvents):", snap.users.filter((u: any) => u.sources?.inCmsEvents).length);
  console.log("Stakers (inAllStakers):", snap.users.filter((u: any) => u.sources?.inAllStakers).length);

  const oldCms = await ethers.getContractAt("CoreMembershipSubscription", OLD_CMS);
  const oldStaking = await ethers.getContractAt("StakingManager", OLD_STAKING);

  // Verify contracts respond
  const globalSubs = await safe(oldCms.totalSubscriptions(), 0n);
  console.log("CMS totalSubscriptions (global):", globalSubs.toString());

  // Collect all users who are CMS buyers OR stakers
  const eligibleUsers = snap.users.filter(
    (u: any) => u.sources?.inCmsEvents || u.sources?.inAllStakers
  );
  console.log("Users to query:", eligibleUsers.length);

  console.log("\nQuerying per-user data from mainnet...");
  let done = 0;
  const seedData = await mapConcurrent(
    eligibleUsers,
    async (u: any) => {
      const addr = u.user;
      
      // Query CMS subscription count
      const subCount = u.sources?.inCmsEvents
        ? await safe(oldCms.subscriptionCount(addr), 0n)
        : 0n;

      // Query active stake value
      let activeOriginal = 0n;
      if (u.sources?.inAllStakers) {
        const stakes: any[] = await safe(oldStaking.getUserStakes(addr), []);
        for (const s of stakes) {
          const active = Boolean(s.active ?? s[7]);
          if (active) {
            activeOriginal += BigInt((s.originalAmount ?? s[1])?.toString() || "0");
          }
        }
      }

      const cmsValue = BigInt(subCount) * CMS_PRICE;
      const totalPrincipal = cmsValue + activeOriginal;

      done++;
      if (done % 50 === 0) console.log(`  progress: ${done}/${eligibleUsers.length}`);

      return {
        user: addr,
        subscriptionCount: Number(subCount),
        cmsValueUsdt: ethers.formatUnits(cmsValue, 18),
        activeOriginalUsdt: ethers.formatUnits(activeOriginal, 18),
        totalPrincipalUsdt: ethers.formatUnits(totalPrincipal, 18),
        totalPrincipalRaw: totalPrincipal.toString(),
        sources: u.sources,
      };
    },
    CONCURRENCY
  );
  console.log(`  progress: ${done}/${eligibleUsers.length}`);

  // Filter to only those with principal > 0
  const toSeed = seedData.filter(d => BigInt(d.totalPrincipalRaw) > 0n);
  const totalPrincipal = toSeed.reduce((a, b) => a + BigInt(b.totalPrincipalRaw), 0n);

  console.log("\n=== Results ===");
  console.log("Users with principal > 0:", toSeed.length);
  console.log("Total principal:", ethers.formatUnits(totalPrincipal, 18), "USDT");
  console.log("CMS subs (per-user sum):", seedData.reduce((a, b) => a + b.subscriptionCount, 0));

  // Breakdown
  const cmsOnly = toSeed.filter(d => d.subscriptionCount > 0 && d.activeOriginalUsdt === "0.0");
  const stakeOnly = toSeed.filter(d => d.subscriptionCount === 0 && d.activeOriginalUsdt !== "0.0");
  const both = toSeed.filter(d => d.subscriptionCount > 0 && d.activeOriginalUsdt !== "0.0");
  console.log("  CMS only:", cmsOnly.length);
  console.log("  Stake only:", stakeOnly.length);
  console.log("  Both:", both.length);

  // Write output
  const output = {
    generatedAt: new Date().toISOString(),
    network: { chainId: 204, name: "opbnbMainnet" },
    queriedContracts: { oldCms: OLD_CMS, oldStaking: OLD_STAKING },
    globalCmsTotalSubscriptions: globalSubs.toString(),
    summary: {
      eligibleUsers: toSeed.length,
      totalPrincipalUsdt: ethers.formatUnits(totalPrincipal, 18),
      cmsOnly: cmsOnly.length,
      stakeOnly: stakeOnly.length,
      both: both.length,
    },
    users: toSeed,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nOutput written: ${OUT_FILE}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
