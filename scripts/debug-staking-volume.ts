import { ethers, formatUnits } from "ethers";
import "dotenv/config";

/**
 * Debug script: Check staking volume and full data for a specific address
 * on opBNB Mainnet (chain 204).
 *
 * Usage: npx ts-node scripts/debug-staking-volume.ts [address]
 */

const TARGET_ADDRESS = process.argv[2] || "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA";

// ── opBNB Mainnet contract addresses ──
const STAKING_MANAGER = "0x21c22de855e87B2124A50d76f31E79152C977090";
const AFFILIATE_DIST = "0x8C7FF618C0Bc7ae9b9fd2828Ba33d977edb99237";
const USDT_TOKEN = "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3";
const KAIRO_TOKEN = "0x8D01409fB9Adc19F5f1Fb7eD47c12D5A88051AeD";

const USDT_DECIMALS = 18;
const RPC = process.env.OPBNB_MAINNET_RPC || "https://opbnb-mainnet-rpc.bnbchain.org";

// ── ABIs ──
const StakingABI = [
  "function getTotalActiveStakeValue(address _user) view returns (uint256)",
  "function userStakes(address, uint256) view returns (uint256 amount, uint256 originalAmount, uint256 startTime, uint256 lastCompoundTime, uint256 harvestedRewards, uint256 totalEarned, uint256 compoundEarned, bool active, uint8 tier)",
  "function totalActiveStakeValue(address) view returns (uint256)",
  "function getRemainingCap(address _user) view returns (uint256)",
  "function hasActivePosition(address _user) view returns (bool)",
  "function getCapProgress(address _user, uint256 _stakeId) view returns (uint256 harvested, uint256 cap)",
  "function getPendingProfit(address _user, uint256 _stakeId) view returns (uint256)",
  "event Staked(address indexed user, uint256 indexed stakeId, uint256 amount, uint8 tier)",
  "event Compounded(address indexed user, uint256 indexed stakeId, uint256 profit)",
  "event Harvested(address indexed user, uint256 indexed stakeId, uint256 amount)",
];

const AffiliateABI = [
  "function getDirectReferrals(address _user) view returns (address[])",
  "function getTeamVolume(address _user) view returns (uint256)",
  "function teamVolume(address) view returns (uint256)",
  "function referrerOf(address) view returns (address)",
  "function isRegistered(address) view returns (bool)",
  "function getUnlockedLevels(address _user) view returns (uint256)",
  "function getUserRankInfo(address _user) view returns (uint256, uint256, uint256, uint256, uint256)",
];

const ERC20ABI = [
  "function balanceOf(address) view returns (uint256)",
];

const RANK_NAMES = [
  "None", "Associate", "Executive", "Director", "Vice President",
  "Senior VP", "Managing Director", "Partner", "Senior Partner",
  "Global Leader", "Chairman",
];

function fmtUsd(val: bigint): string {
  return `$${Number(formatUnits(val, USDT_DECIMALS)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const userAddr = ethers.getAddress(TARGET_ADDRESS);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  KAIRO DAO — Staking Volume Debug (Mainnet)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Target Address : ${userAddr}`);
  console.log(`  RPC            : ${RPC}`);
  console.log(`  Network        : opBNB Mainnet (204)`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const staking = new ethers.Contract(STAKING_MANAGER, StakingABI, provider);
  const affiliate = new ethers.Contract(AFFILIATE_DIST, AffiliateABI, provider);
  const usdt = new ethers.Contract(USDT_TOKEN, ERC20ABI, provider);
  const kairo = new ethers.Contract(KAIRO_TOKEN, ERC20ABI, provider);

  // ── 1. BALANCES ──
  console.log("─── 1. WALLET BALANCES ───────────────────────────────────");
  const [bnbBal, usdtBal, kairoBal] = await Promise.all([
    provider.getBalance(userAddr),
    usdt.balanceOf(userAddr),
    kairo.balanceOf(userAddr),
  ]);
  console.log(`  BNB   : ${formatUnits(bnbBal, 18)}`);
  console.log(`  USDT  : ${fmtUsd(usdtBal)}`);
  console.log(`  KAIRO : ${formatUnits(kairoBal, 18)}`);
  console.log();

  // ── 2. REGISTRATION ──
  console.log("─── 2. REGISTRATION & REFERRER ───────────────────────────");
  try {
    const isReg = await affiliate.isRegistered(userAddr);
    const referrer = await affiliate.referrerOf(userAddr);
    console.log(`  Registered : ${isReg}`);
    console.log(`  Referrer   : ${referrer}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message?.slice(0, 200)}`);
  }
  console.log();

  // ── 3. STAKING DATA ──
  console.log("─── 3. STAKING DATA ──────────────────────────────────────");
  let totalActiveVal = 0n;
  let hasActive = false;
  try {
    totalActiveVal = await staking.getTotalActiveStakeValue(userAddr);
    hasActive = await staking.hasActivePosition(userAddr);
    const remainingCap = await staking.getRemainingCap(userAddr);
    console.log(`  Total Active Stake Value : ${fmtUsd(totalActiveVal)}`);
    console.log(`  Has Active Position      : ${hasActive}`);
    console.log(`  Remaining 3X Cap         : ${fmtUsd(remainingCap)}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message?.slice(0, 200)}`);
  }

  // Enumerate individual stakes
  const MIN_HARVEST = BigInt(10) * BigInt(10 ** 18);
  let stakeIdx = 0;
  let totalHarvestable = 0n;
  let stakesAboveMin = 0;
  while (true) {
    try {
      const s = await staking.userStakes(userAddr, stakeIdx);
      const harvestable = BigInt(s.compoundEarned) - BigInt(s.harvestedRewards);
      totalHarvestable += harvestable > 0n ? harvestable : 0n;
      const meetsMin = harvestable >= MIN_HARVEST;
      if (meetsMin) stakesAboveMin++;

      console.log(`\n  Stake #${stakeIdx}:`);
      console.log(`    Amount (compounded) : ${fmtUsd(s.amount)}`);
      console.log(`    Original Amount     : ${fmtUsd(s.originalAmount)}`);
      console.log(`    Active              : ${s.active}`);
      console.log(`    Tier                : ${["Bronze", "Silver", "Gold"][s.tier] || s.tier}`);
      console.log(`    Start Time          : ${new Date(Number(s.startTime) * 1000).toISOString()}`);
      console.log(`    Last Compound       : ${new Date(Number(s.lastCompoundTime) * 1000).toISOString()}`);
      console.log(`    Compound Earned     : ${fmtUsd(s.compoundEarned)}`);
      console.log(`    Harvested Rewards   : ${fmtUsd(s.harvestedRewards)}`);
      console.log(`    Harvestable         : ${fmtUsd(BigInt(harvestable))} ${meetsMin ? "✅ (>=$10)" : "❌ (<$10)"}`);
      console.log(`    Total Earned (cap)  : ${fmtUsd(s.totalEarned)}`);
      const cap = s.originalAmount * 3n;
      console.log(`    3X Cap Limit        : ${fmtUsd(cap)}`);
      console.log(`    Cap Progress        : ${cap > 0n ? ((Number(s.totalEarned) / Number(cap)) * 100).toFixed(2) : 0}%`);

      // pendingProfit (virtual uncompounded)
      try {
        const pending = await staking.getPendingProfit(userAddr, stakeIdx);
        console.log(`    Pending Profit      : ${fmtUsd(pending)} (needs compound to crystallize)`);
      } catch {
        console.log(`    Pending Profit      : (function unavailable)`);
      }

      stakeIdx++;
    } catch {
      break;
    }
  }
  console.log(`\n  ─────────────────────────────────────────────`);
  console.log(`  Total stakes found      : ${stakeIdx}`);
  console.log(`  Total Harvestable       : ${fmtUsd(totalHarvestable)}`);
  console.log(`  Stakes meeting $10 min  : ${stakesAboveMin}`);
  console.log(`  Harvest button enabled  : ${stakesAboveMin > 0 ? "YES ✅" : "NO ❌ (no single stake >= $10)"}`);
  console.log();

  // ── 4. RANK & TEAM INFO ──
  console.log("─── 4. RANK & TEAM INFO ──────────────────────────────────");
  try {
    const ri = await affiliate.getUserRankInfo(userAddr);
    console.log(`  Stored Rank      : ${RANK_NAMES[Number(ri[0])] || ri[0]} (${ri[0]})`);
    console.log(`  Live Rank        : ${RANK_NAMES[Number(ri[1])] || ri[1]} (${ri[1]})`);
    console.log(`  Rank Salary      : ${fmtUsd(ri[2])}`);
  } catch (e: any) {
    console.log(`  Rank info error: ${e.message?.slice(0, 100)}`);
  }
  try {
    const teamVol = await affiliate.getTeamVolume(userAddr);
    const unlockedLvls = await affiliate.getUnlockedLevels(userAddr);
    console.log(`  Team Volume      : ${fmtUsd(teamVol)}`);
    console.log(`  Unlocked Levels  : ${unlockedLvls}`);
  } catch (e: any) {
    console.log(`  Team volume error: ${e.message?.slice(0, 100)}`);
  }
  console.log();

  // ── 5. DIRECT REFERRALS ──
  console.log("─── 5. DIRECT REFERRALS ──────────────────────────────────");
  try {
    const directRefs: string[] = await affiliate.getDirectReferrals(userAddr);
    console.log(`  Direct Referral Count : ${directRefs.length}`);
    let directBusiness = 0n;
    for (let i = 0; i < Math.min(directRefs.length, 20); i++) {
      const ref = directRefs[i];
      const activeVal = await staking.getTotalActiveStakeValue(ref);
      directBusiness += activeVal;
      if (activeVal > 0n) {
        console.log(`    ${ref} → ${fmtUsd(activeVal)} ✅`);
      }
    }
    console.log(`  Direct Business       : ${fmtUsd(directBusiness)}`);
    if (directRefs.length > 20) {
      console.log(`  (showing first 20 of ${directRefs.length})`);
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message?.slice(0, 200)}`);
  }
  console.log();

  // ── 6. STAKING EVENTS ──
  console.log("─── 6. STAKE EVENTS (last 10) ────────────────────────────");
  try {
    const stakedFilter = staking.filters.Staked(userAddr);
    const events = await staking.queryFilter(stakedFilter, 0);
    console.log(`  Total Staked events: ${events.length}`);
    for (const ev of events.slice(-10)) {
      const args = (ev as any).args;
      const dt = ev.blockNumber;
      console.log(`    Block ${dt}: stakeId=${args[1]}, amount=${fmtUsd(args[2])}, tier=${["Bronze", "Silver", "Gold"][Number(args[3])] || args[3]}`);
    }
  } catch (e: any) {
    console.log(`  Events error: ${e.message?.slice(0, 150)}`);
  }
  console.log();

  // ── 7. COMPOUND EVENTS ──
  console.log("─── 7. COMPOUND EVENTS (last 10) ─────────────────────────");
  try {
    const compoundFilter = staking.filters.Compounded(userAddr);
    const events = await staking.queryFilter(compoundFilter, 0);
    console.log(`  Total Compounded events: ${events.length}`);
    for (const ev of events.slice(-10)) {
      const args = (ev as any).args;
      console.log(`    Block ${ev.blockNumber}: stakeId=${args[1]}, profit=${fmtUsd(args[2])}`);
    }
  } catch (e: any) {
    console.log(`  Events error: ${e.message?.slice(0, 150)}`);
  }
  console.log();

  // ── 8. HARVEST EVENTS ──
  console.log("─── 8. HARVEST EVENTS (last 10) ──────────────────────────");
  try {
    const harvestFilter = staking.filters.Harvested(userAddr);
    const events = await staking.queryFilter(harvestFilter, 0);
    console.log(`  Total Harvested events: ${events.length}`);
    for (const ev of events.slice(-10)) {
      const args = (ev as any).args;
      console.log(`    Block ${ev.blockNumber}: stakeId=${args[1]}, amount=${fmtUsd(args[2])}`);
    }
  } catch (e: any) {
    console.log(`  Events error: ${e.message?.slice(0, 150)}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DEBUG COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
