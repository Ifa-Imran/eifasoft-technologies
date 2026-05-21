import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Full state backup of the OLD contracts (StakingManager + AffiliateDistributor +
 * CoreMembershipSubscription + KAIROToken + USDT) into a single JSON snapshot.
 *
 * Captures EVERY user-level field needed to reconcile / replay state into the
 * new v30 StakingManager. Designed to be safe to run multiple times — it is
 * read-only and writes one timestamped file per run.
 *
 * Required env (read from process.env):
 *   OLD_STAKING_MANAGER     - address of old StakingManager
 *   OLD_AFFILIATE           - address of old AffiliateDistributor
 *   OLD_CMS                 - address of old CoreMembershipSubscription
 *   KAIRO_TOKEN_CONTRACT    - address of KAIRO token (optional)
 *   USDT_TOKEN_ADDRESS      - address of USDT token (optional)
 *   BACKUP_OUT_DIR          - output directory (defaults to ./backups)
 *
 * Run:
 *   npx hardhat run scripts/backup-old-contracts.ts --network opbnb
 */

const OLD_STAKING_MANAGER = process.env.OLD_STAKING_MANAGER || "";
const OLD_AFFILIATE = process.env.OLD_AFFILIATE || "";
const OLD_CMS = process.env.OLD_CMS || "";
const KAIRO_TOKEN = process.env.KAIRO_TOKEN_CONTRACT || "";
const USDT_TOKEN = process.env.USDT_TOKEN_ADDRESS || "";

const OUT_DIR = process.env.BACKUP_OUT_DIR || path.join(__dirname, "..", "backups");

// Tunables
const USER_CONCURRENCY = 8;     // parallel user reads
const EVENT_CHUNK = 50_000;     // for paginated event scans (if needed)

// ---------- helpers ----------

function requireAddress(name: string, value: string) {
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${name} is not set or not a valid address. Got: ${value}`);
  }
}

// JSON.stringify replacer that turns bigints into strings.
function bigintReplacer(_key: string, value: any) {
  if (typeof value === "bigint") return value.toString();
  return value;
}

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, idx: number) => Promise<R>,
  concurrency: number,
  onProgress?: (done: number, total: number) => void
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const total = items.length;
  async function run() {
    while (true) {
      const i = next++;
      if (i >= total) return;
      out[i] = await worker(items[i], i);
      done++;
      if (onProgress && done % 25 === 0) onProgress(done, total);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, run));
  if (onProgress) onProgress(done, total);
  return out;
}

// ---------- collectors ----------

async function collectStakers(oldStaking: any): Promise<string[]> {
  const set = new Set<string>();
  try {
    const total: bigint = await oldStaking.getStakerCount();
    const totalNum = Number(total);
    const page = 500;
    for (let i = 0; i < totalNum; i += page) {
      const slice: string[] = await oldStaking.getStakers(i, Math.min(page, totalNum - i));
      slice.forEach((a) => set.add(a.toLowerCase()));
    }
  } catch {
    const list: string[] = await oldStaking.getAllStakers();
    list.forEach((a) => set.add(a.toLowerCase()));
  }
  return Array.from(set);
}

async function collectRegistered(oldAffiliate: any): Promise<string[]> {
  const list: string[] = await oldAffiliate.getAllRegistered();
  return list.map((a) => a.toLowerCase());
}

async function collectCmsBuyers(oldCms: any, fromBlock: number, toBlock: number): Promise<string[]> {
  const set = new Set<string>();
  // SubscriptionPurchased(buyer, count, totalSubs)
  const filter = oldCms.filters.SubscriptionPurchased();
  // chunked scan for safety against RPC limits
  for (let from = fromBlock; from <= toBlock; from += EVENT_CHUNK) {
    const to = Math.min(from + EVENT_CHUNK - 1, toBlock);
    try {
      const events = await oldCms.queryFilter(filter, from, to);
      for (const ev of events) {
        const buyer: string = ev.args?.buyer || ev.args?.[0];
        if (buyer) set.add(buyer.toLowerCase());
      }
    } catch (e) {
      console.warn(`  warn: event scan ${from}-${to} failed, skipping chunk`);
    }
  }
  return Array.from(set);
}

// ---------- per-user readers ----------

async function readStakingUser(oldStaking: any, user: string) {
  const [
    rawStakes,
    totalActiveStakeValue,
    totalIncomeClaimedUsd,
    totalIncomeDeductedUsd,
    autoCompoundEnabled,
    isStakerFlag,
  ] = await Promise.all([
    safe<any[]>(oldStaking.getUserStakes(user), []),
    safe<bigint>(oldStaking.totalActiveStakeValue(user), 0n),
    safe<bigint>(oldStaking.totalIncomeClaimedUsd(user), 0n),
    safe<bigint>(oldStaking.totalIncomeDeductedUsd(user), 0n),
    safe<boolean>(oldStaking.autoCompoundEnabled(user), false),
    safe<boolean>(
      // isStaker is private; derive via getUserStakes length > 0 fallback
      Promise.resolve(true),
      false
    ),
  ]);
  const stakes = rawStakes.map((s: any) => ({
    amount: s.amount?.toString() ?? s[0]?.toString(),
    originalAmount: s.originalAmount?.toString() ?? s[1]?.toString(),
    startTime: (s.startTime ?? s[2])?.toString(),
    lastCompoundTime: (s.lastCompoundTime ?? s[3])?.toString(),
    harvestedRewards: (s.harvestedRewards ?? s[4])?.toString(),
    totalEarned: (s.totalEarned ?? s[5])?.toString(),
    compoundEarned: (s.compoundEarned ?? s[6])?.toString(),
    active: Boolean(s.active ?? s[7]),
    tier: Number(s.tier ?? s[8]),
  }));
  let activeOriginalSum = 0n;
  let activeAmountSum = 0n;
  for (const s of stakes) {
    if (s.active) {
      activeOriginalSum += BigInt(s.originalAmount || "0");
      activeAmountSum += BigInt(s.amount || "0");
    }
  }
  return {
    stakes,
    derived: {
      stakeCount: stakes.length,
      activeStakeCount: stakes.filter((s) => s.active).length,
      activeOriginalSum: activeOriginalSum.toString(),
      activeAmountSum: activeAmountSum.toString(),
    },
    totalActiveStakeValue: totalActiveStakeValue.toString(),
    totalIncomeClaimedUsd: totalIncomeClaimedUsd.toString(),
    totalIncomeDeductedUsd: totalIncomeDeductedUsd.toString(),
    autoCompoundEnabled,
    isStakerFlag,
  };
}

async function readAffiliateUser(oldAffiliate: any, user: string) {
  const [
    referrer,
    directs,
    personalVolume,
    teamVolume,
    directCount,
    rankLevel,
    lastRankClaimTime,
    directDividends,
    teamDividends,
    rankDividends,
    pendingRankSalary,
  ] = await Promise.all([
    safe<string>(oldAffiliate.referrerOf(user), ethers.ZeroAddress),
    safe<string[]>(oldAffiliate.getDirectReferrals(user), []),
    safe<bigint>(oldAffiliate.personalVolume(user), 0n),
    safe<bigint>(oldAffiliate.teamVolume(user), 0n),
    safe<bigint>(oldAffiliate.directCount(user), 0n),
    safe<bigint>(oldAffiliate.userRankLevel(user), 0n),
    safe<bigint>(oldAffiliate.lastRankClaimTime(user), 0n),
    safe<bigint>(oldAffiliate.directDividends(user), 0n),
    safe<bigint>(oldAffiliate.teamDividends(user), 0n),
    safe<bigint>(oldAffiliate.rankDividends(user), 0n),
    safe<bigint>(oldAffiliate.pendingRankSalary(user), 0n),
  ]);
  return {
    referrer: referrer.toLowerCase(),
    directReferrals: directs.map((a) => a.toLowerCase()),
    personalVolume: personalVolume.toString(),
    teamVolume: teamVolume.toString(),
    directCount: directCount.toString(),
    rankLevel: Number(rankLevel),
    lastRankClaimTime: lastRankClaimTime.toString(),
    directDividends: directDividends.toString(),
    teamDividends: teamDividends.toString(),
    rankDividends: rankDividends.toString(),
    pendingRankSalary: pendingRankSalary.toString(),
  };
}

async function readCmsUser(oldCms: any, user: string) {
  const [
    subscriptionCount,
    loyaltyRewards,
    leadershipRewards,
    hasClaimed,
    referrer,
    cmsDirectCount,
    levelSubs,
    levelRewards,
  ] = await Promise.all([
    safe<bigint>(oldCms.subscriptionCount(user), 0n),
    safe<bigint>(oldCms.loyaltyRewards(user), 0n),
    safe<bigint>(oldCms.leadershipRewards(user), 0n),
    safe<boolean>(oldCms.hasClaimed(user), false),
    safe<string>(oldCms.referrerOf(user), ethers.ZeroAddress),
    safe<bigint>(oldCms.cmsDirectCount(user), 0n),
    safe<bigint[]>(
      Promise.all([0, 1, 2, 3, 4].map((i) => oldCms.levelSubscriptions(user, i))) as Promise<bigint[]>,
      [0n, 0n, 0n, 0n, 0n]
    ),
    safe<bigint[]>(
      Promise.all([0, 1, 2, 3, 4].map((i) => oldCms.levelRewardsEarned(user, i))) as Promise<bigint[]>,
      [0n, 0n, 0n, 0n, 0n]
    ),
  ]);
  return {
    subscriptionCount: subscriptionCount.toString(),
    loyaltyRewards: loyaltyRewards.toString(),
    leadershipRewards: leadershipRewards.toString(),
    hasClaimed,
    referrer: referrer.toLowerCase(),
    cmsDirectCount: cmsDirectCount.toString(),
    levelSubscriptions: levelSubs.map((b) => b.toString()),
    levelRewardsEarned: levelRewards.map((b) => b.toString()),
  };
}

// ---------- main ----------

async function main() {
  requireAddress("OLD_STAKING_MANAGER", OLD_STAKING_MANAGER);
  requireAddress("OLD_AFFILIATE", OLD_AFFILIATE);
  requireAddress("OLD_CMS", OLD_CMS);

  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);

  console.log("=== Old Contracts Backup ===");
  console.log("network         :", network.name, `(chainId=${network.chainId})`);
  console.log("blockNumber     :", blockNumber);
  console.log("blockTimestamp  :", block?.timestamp);
  console.log("OLD_STAKING     :", OLD_STAKING_MANAGER);
  console.log("OLD_AFFILIATE   :", OLD_AFFILIATE);
  console.log("OLD_CMS         :", OLD_CMS);
  console.log("KAIRO_TOKEN     :", KAIRO_TOKEN || "(skipped)");
  console.log("USDT_TOKEN      :", USDT_TOKEN || "(skipped)");

  const oldStaking = await ethers.getContractAt("StakingManager", OLD_STAKING_MANAGER);
  const oldAffiliate = await ethers.getContractAt("AffiliateDistributor", OLD_AFFILIATE);
  const oldCms = await ethers.getContractAt("CoreMembershipSubscription", OLD_CMS);
  const kairo = KAIRO_TOKEN ? await ethers.getContractAt("KAIROToken", KAIRO_TOKEN) : null;
  const usdt = USDT_TOKEN
    ? await ethers.getContractAt(
        ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)", "function symbol() view returns (string)"],
        USDT_TOKEN
      )
    : null;

  // 1. Build merged user set
  console.log("\n[1/5] Collecting users from all three contracts...");
  const stakers = await collectStakers(oldStaking);
  console.log(`  stakers (StakingManager.allStakers)        : ${stakers.length}`);
  const registered = await collectRegistered(oldAffiliate);
  console.log(`  registered (Affiliate.allRegistered)       : ${registered.length}`);
  const cmsBuyers = await collectCmsBuyers(oldCms, 0, blockNumber);
  console.log(`  cms buyers (SubscriptionPurchased events)  : ${cmsBuyers.length}`);

  const merged = new Set<string>([...stakers, ...registered, ...cmsBuyers]);
  const users = Array.from(merged).sort();
  console.log(`  merged unique users                        : ${users.length}`);

  // 2. Global state
  console.log("\n[2/5] Reading global state...");
  const [
    genesisAccount,
    affiliateStakingManager,
    affiliateSystemWallet,
    cmsTotalSubs,
    cmsSubscribeDeadline,
    cmsClaimDeadline,
    cmsSystemWallet,
    stakingAffiliate,
    stakingCms,
    stakingDevFund,
    stakingMigrationFinalized,
    stakingTotalStaked,
  ] = await Promise.all([
    safe<string>(oldAffiliate.genesisAccount(), ethers.ZeroAddress),
    safe<string>(oldAffiliate.stakingManager(), ethers.ZeroAddress),
    safe<string>(oldAffiliate.systemWallet(), ethers.ZeroAddress),
    safe<bigint>(oldCms.totalSubscriptions(), 0n),
    safe<bigint>(oldCms.SUBSCRIBE_DEADLINE(), 0n),
    safe<bigint>(oldCms.CLAIM_DEADLINE(), 0n),
    safe<string>(oldCms.systemWallet(), ethers.ZeroAddress),
    safe<string>(oldStaking.affiliateDistributor(), ethers.ZeroAddress),
    safe<string>(oldStaking.cmsContract(), ethers.ZeroAddress),
    safe<string>(oldStaking.developmentFundWallet(), ethers.ZeroAddress),
    safe<boolean>(oldStaking.migrationFinalized(), false),
    safe<bigint>((oldStaking as any).totalStaked?.() ?? Promise.resolve(0n), 0n),
  ]);

  // Token balances on the contracts (sanity)
  const balances: Record<string, Record<string, string>> = {};
  if (usdt) {
    balances.usdt = {
      stakingManager: (await safe<bigint>(usdt.balanceOf(OLD_STAKING_MANAGER), 0n)).toString(),
      affiliate: (await safe<bigint>(usdt.balanceOf(OLD_AFFILIATE), 0n)).toString(),
      cms: (await safe<bigint>(usdt.balanceOf(OLD_CMS), 0n)).toString(),
    };
  }
  if (kairo) {
    balances.kairo = {
      totalSupply: (await safe<bigint>(kairo.totalSupply(), 0n)).toString(),
      stakingManager: (await safe<bigint>(kairo.balanceOf(OLD_STAKING_MANAGER), 0n)).toString(),
      affiliate: (await safe<bigint>(kairo.balanceOf(OLD_AFFILIATE), 0n)).toString(),
      cms: (await safe<bigint>(kairo.balanceOf(OLD_CMS), 0n)).toString(),
    };
  }

  // 3. Per-user reads
  console.log(`\n[3/5] Reading per-user state for ${users.length} addresses (concurrency=${USER_CONCURRENCY})...`);
  const userRecords = await mapWithConcurrency(
    users,
    async (user) => {
      const [staking, affiliate, cms] = await Promise.all([
        readStakingUser(oldStaking, user),
        readAffiliateUser(oldAffiliate, user),
        readCmsUser(oldCms, user),
      ]);
      const sources = {
        inAllStakers: stakers.includes(user),
        inAllRegistered: registered.includes(user),
        inCmsEvents: cmsBuyers.includes(user),
      };
      return { user, sources, staking, affiliate, cms };
    },
    USER_CONCURRENCY,
    (done, total) => console.log(`  progress: ${done}/${total}`)
  );

  // 4. Aggregate sanity totals
  console.log("\n[4/5] Computing aggregates...");
  let sumActiveOriginal = 0n;
  let sumActiveAmount = 0n;
  let sumPersonalVolume = 0n;
  let sumTeamVolume = 0n;
  let sumSubscriptions = 0n;
  let sumDirectDividends = 0n;
  let sumTeamDividends = 0n;
  let sumRankDividends = 0n;
  for (const r of userRecords) {
    sumActiveOriginal += BigInt(r.staking.derived.activeOriginalSum);
    sumActiveAmount += BigInt(r.staking.derived.activeAmountSum);
    sumPersonalVolume += BigInt(r.affiliate.personalVolume);
    sumTeamVolume += BigInt(r.affiliate.teamVolume);
    sumSubscriptions += BigInt(r.cms.subscriptionCount);
    sumDirectDividends += BigInt(r.affiliate.directDividends);
    sumTeamDividends += BigInt(r.affiliate.teamDividends);
    sumRankDividends += BigInt(r.affiliate.rankDividends);
  }

  const aggregates = {
    userCount: userRecords.length,
    sumActiveOriginalUsd18: sumActiveOriginal.toString(),
    sumActiveAmountUsd18: sumActiveAmount.toString(),
    sumPersonalVolumeUsd18: sumPersonalVolume.toString(),
    sumTeamVolumeUsd18: sumTeamVolume.toString(),
    sumSubscriptions: sumSubscriptions.toString(),
    cmsTotalSubscriptions: cmsTotalSubs.toString(),
    sumDirectDividendsUsd18: sumDirectDividends.toString(),
    sumTeamDividendsUsd18: sumTeamDividends.toString(),
    sumRankDividendsUsd18: sumRankDividends.toString(),
    subscriptionCountMatchesGlobal: sumSubscriptions === cmsTotalSubs,
  };

  // 5. Build snapshot + write file
  const snapshot = {
    meta: {
      tool: "backup-old-contracts",
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      network: { name: network.name, chainId: network.chainId.toString() },
      block: { number: blockNumber, timestamp: block?.timestamp ?? null, hash: block?.hash ?? null },
      addresses: {
        oldStakingManager: OLD_STAKING_MANAGER,
        oldAffiliateDistributor: OLD_AFFILIATE,
        oldCms: OLD_CMS,
        kairoToken: KAIRO_TOKEN || null,
        usdtToken: USDT_TOKEN || null,
      },
    },
    global: {
      affiliate: {
        genesisAccount,
        stakingManager: affiliateStakingManager,
        systemWallet: affiliateSystemWallet,
      },
      cms: {
        totalSubscriptions: cmsTotalSubs.toString(),
        subscribeDeadline: cmsSubscribeDeadline.toString(),
        claimDeadline: cmsClaimDeadline.toString(),
        systemWallet: cmsSystemWallet,
      },
      staking: {
        affiliateDistributor: stakingAffiliate,
        cmsContract: stakingCms,
        developmentFundWallet: stakingDevFund,
        migrationFinalized: stakingMigrationFinalized,
        totalStaked: stakingTotalStaked.toString(),
      },
      contractBalances: balances,
    },
    sources: {
      stakersCount: stakers.length,
      registeredCount: registered.length,
      cmsBuyersCount: cmsBuyers.length,
      mergedUserCount: userRecords.length,
    },
    aggregates,
    users: userRecords,
  };

  console.log("\n[5/5] Writing snapshot file...");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `kairodao-backup-${network.chainId}-${blockNumber}-${stamp}.json`;
  const outPath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, bigintReplacer, 2));
  console.log(`\nSnapshot written: ${outPath}`);
  console.log(`  size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
  console.log(`  users: ${userRecords.length}`);
  console.log(`  sumActiveOriginal: ${ethers.formatUnits(sumActiveOriginal, 18)} USDT`);
  console.log(`  sumPersonalVolume: ${ethers.formatUnits(sumPersonalVolume, 18)} USDT`);
  console.log(`  cms subs (global):  ${cmsTotalSubs.toString()}  | sumPerUser: ${sumSubscriptions.toString()}`);
  if (!aggregates.subscriptionCountMatchesGlobal) {
    console.warn("  WARN: per-user subscription sum != cms.totalSubscriptions");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
