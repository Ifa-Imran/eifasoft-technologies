import { ethers } from "ethers";
import "dotenv/config";

/**
 * Debug script: Check salary harvested & salary history for a specific address.
 * Checks on-chain events (RankSalaryClaimed, Harvested with incomeType=2),
 * rank info, and current state.
 *
 * Usage: npx ts-node scripts/debug-salary-history.ts [address]
 */

const TARGET_ADDRESS = process.argv[2] || "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA";
const AFFILIATE_DIST = "0x8C7FF618C0Bc7ae9b9fd2828Ba33d977edb99237";
const RPC = process.env.OPBNB_MAINNET_RPC || "https://opbnb-mainnet-rpc.bnbchain.org";

const AffiliateABI = [
  "function getUserRankInfo(address _user) view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256)",
  "function getAllIncome(address _user) view returns (uint256, uint256, uint256)",
  "function rankDividends(address) view returns (uint256)",
  "function userRankLevel(address) view returns (uint256)",
  "function lastRankClaimTime(address) view returns (uint256)",
  "function teamVolume(address) view returns (uint256)",
  "function RANK_INTERVAL() view returns (uint256)",
  "function pendingRankSalary(address) view returns (uint256)",
  "event RankSalaryClaimed(address indexed user, uint256 rankLevel, uint256 salary)",
  "event Harvested(address indexed user, uint8 incomeType, uint256 usdAmount, uint256 kairoAmount)",
  "event RankChanged(address indexed user, uint256 oldRank, uint256 newRank)",
];

const fmt = (v: bigint) => `$${Number(ethers.formatEther(v)).toFixed(4)}`;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const ad = new ethers.Contract(AFFILIATE_DIST, AffiliateABI, provider);

  console.log("=== SALARY HISTORY DEBUG ===");
  console.log(`Target: ${TARGET_ADDRESS}`);
  console.log(`AffiliateDistributor: ${AFFILIATE_DIST}`);
  console.log(`RPC: ${RPC}`);
  console.log("");

  // 1. Basic rank info
  const rankInfo = await ad.getUserRankInfo(TARGET_ADDRESS);
  const storedRank = Number(rankInfo[0]);
  const liveRank = Number(rankInfo[1]);
  const salary = BigInt(rankInfo[2]);
  const lastClaimed = Number(rankInfo[3]);
  const nextClaimTime = Number(rankInfo[4]);
  const pendingSalary = BigInt(rankInfo[5]);
  const totalRankHarvestable = BigInt(rankInfo[6]);

  console.log("--- Rank Info ---");
  console.log(`  storedRank:           ${storedRank}`);
  console.log(`  liveRank:             ${liveRank}`);
  console.log(`  salary/period:        ${fmt(salary)}`);
  console.log(`  lastRankClaimTime:    ${lastClaimed} (${lastClaimed > 0 ? new Date(lastClaimed * 1000).toISOString() : 'NEVER'})`);
  console.log(`  nextClaimTime:        ${nextClaimTime} (${nextClaimTime > 0 ? new Date(nextClaimTime * 1000).toISOString() : 'N/A'})`);
  console.log(`  pendingRankSalary:    ${fmt(pendingSalary)}`);
  console.log(`  totalRankHarvestable: ${fmt(totalRankHarvestable)}`);
  console.log("");

  // 2. All income balances
  const allIncome = await ad.getAllIncome(TARGET_ADDRESS);
  console.log("--- All Income (harvestable) ---");
  console.log(`  direct:  ${fmt(BigInt(allIncome[0]))}`);
  console.log(`  team:    ${fmt(BigInt(allIncome[1]))}`);
  console.log(`  rank:    ${fmt(BigInt(allIncome[2]))}`);
  console.log("");

  // 3. rankDividends (accrued)
  const rankDiv = await ad.rankDividends(TARGET_ADDRESS);
  console.log(`  rankDividends (stored): ${fmt(BigInt(rankDiv))}`);

  // 4. RANK_INTERVAL
  const interval = await ad.RANK_INTERVAL();
  console.log(`  RANK_INTERVAL:         ${Number(interval)} seconds (${Number(interval) / 3600} hours)`);
  console.log("");

  // 5. Fetch RankSalaryClaimed events
  const latestBlock = await provider.getBlockNumber();
  const safeFrom = Math.max(0, latestBlock - 5_000_000);
  console.log(`--- Event Query: blocks ${safeFrom} to ${latestBlock} ---`);
  console.log("");

  console.log("--- RankSalaryClaimed events ---");
  try {
    const filter = ad.filters.RankSalaryClaimed(TARGET_ADDRESS);
    const logs = await ad.queryFilter(filter, safeFrom, latestBlock);
    console.log(`  Found ${logs.length} RankSalaryClaimed events`);
    for (const log of logs) {
      const args = (log as any).args;
      const block = await provider.getBlock(log.blockNumber);
      const ts = block ? new Date(block.timestamp * 1000).toISOString() : '?';
      console.log(`    Block ${log.blockNumber} | ${ts} | Rank ${Number(args[1])} | Salary ${fmt(BigInt(args[2]))} | Tx: ${log.transactionHash}`);
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
  console.log("");

  // 6. Fetch Harvested events (all income types for this user)
  console.log("--- Harvested events (all types) ---");
  try {
    const filter = ad.filters.Harvested(TARGET_ADDRESS);
    const logs = await ad.queryFilter(filter, safeFrom, latestBlock);
    console.log(`  Found ${logs.length} Harvested events total`);
    let rankHarvestCount = 0;
    for (const log of logs) {
      const args = (log as any).args;
      const incomeType = Number(args[1]);
      const usdAmount = BigInt(args[2]);
      const kairoAmount = BigInt(args[3]);
      const typeLabel = incomeType === 0 ? "direct" : incomeType === 1 ? "team" : "rank";
      const block = await provider.getBlock(log.blockNumber);
      const ts = block ? new Date(block.timestamp * 1000).toISOString() : '?';
      console.log(`    Block ${log.blockNumber} | ${ts} | Type: ${typeLabel}(${incomeType}) | USD: ${fmt(usdAmount)} | KAIRO: ${ethers.formatEther(kairoAmount)} | Tx: ${log.transactionHash}`);
      if (incomeType === 2) rankHarvestCount++;
    }
    console.log(`  Rank salary harvests: ${rankHarvestCount}`);
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
  console.log("");

  // 7. Fetch RankChanged events
  console.log("--- RankChanged events ---");
  try {
    const filter = ad.filters.RankChanged(TARGET_ADDRESS);
    const logs = await ad.queryFilter(filter, safeFrom, latestBlock);
    console.log(`  Found ${logs.length} RankChanged events`);
    for (const log of logs) {
      const args = (log as any).args;
      console.log(`    Block ${log.blockNumber} | Old: ${Number(args[1])} -> New: ${Number(args[2])} | Tx: ${log.transactionHash}`);
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
  console.log("");

  // 8. Check genesis/system wallet for large-scale history
  console.log("--- Checking ALL RankSalaryClaimed events (any user, last 500K blocks) ---");
  try {
    const recentFrom = Math.max(0, latestBlock - 500_000);
    const filter = ad.filters.RankSalaryClaimed();
    const logs = await ad.queryFilter(filter, recentFrom, latestBlock);
    console.log(`  Found ${logs.length} RankSalaryClaimed events in last 500K blocks`);
    for (const log of logs.slice(0, 20)) {
      const args = (log as any).args;
      console.log(`    User: ${args[0]} | Rank ${Number(args[1])} | Salary ${fmt(BigInt(args[2]))} | Tx: ${log.transactionHash}`);
    }
    if (logs.length > 20) console.log(`    ... and ${logs.length - 20} more`);
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
  console.log("");

  // 9. Check ALL Harvested events (any user, rank type only, last 500K blocks)
  console.log("--- Checking ALL Harvested events (any user, last 500K blocks) ---");
  try {
    const recentFrom = Math.max(0, latestBlock - 500_000);
    const filter = ad.filters.Harvested();
    const logs = await ad.queryFilter(filter, recentFrom, latestBlock);
    console.log(`  Found ${logs.length} Harvested events total`);
    const rankHarvests = logs.filter((l: any) => Number((l as any).args[1]) === 2);
    console.log(`  Of which ${rankHarvests.length} are rank salary harvests`);
    for (const log of logs.slice(0, 20)) {
      const args = (log as any).args;
      const typeLabel = Number(args[1]) === 0 ? "direct" : Number(args[1]) === 1 ? "team" : "rank";
      console.log(`    User: ${args[0]} | Type: ${typeLabel} | USD: ${fmt(BigInt(args[2]))} | Tx: ${log.transactionHash}`);
    }
    if (logs.length > 20) console.log(`    ... and ${logs.length - 20} more`);
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
