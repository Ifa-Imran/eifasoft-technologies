import { ethers, formatUnits } from "ethers";
import "dotenv/config";

// ── Contract addresses (opBNB Testnet v24) ──
const STAKING_MANAGER   = "0x0F26f57606581ac1cFD06c8431F8Ed5d32D5e57D";
const AFFILIATE_DIST    = "0x35DB2f9BB8D0702c81285E813490317d9431cD39";
const USDT_TOKEN        = "0xd43f9a36Fa8C12f807Ef0D1661A5C2FF9248800a";
const KAIRO_TOKEN       = "0x1400F88FC4341740e277A0DCaED90CD3DCbE4b86";
const LIQUIDITY_POOL    = "0xe78BE09835882248ae336FA6D66f1d90f3F2B8de";

const USDT_DECIMALS = 18;
const RPC = process.env.OPBNB_TESTNET_RPC || "https://opbnb-testnet.publicnode.com";

// Wallet to debug — use the provided private key
const DEBUG_PRIVATE_KEY = "7e58650618428dc840047c3d352d0f42c9bd6e9762b8997cdb230fa5f72b6924";

// ── Minimal ABIs ──
const StakingABI = [
  "function getTotalActiveStakeValue(address _user) view returns (uint256)",
  "function userStakes(address, uint256) view returns (uint256 amount, uint256 originalAmount, uint256 startTime, uint256 lastCompoundTime, uint256 harvestedRewards, uint256 totalEarned, uint256 compoundEarned, bool active, uint8 tier)",
  "function totalActiveStakeValue(address) view returns (uint256)",
  "function getRemainingCap(address _user) view returns (uint256)",
  "function hasActivePosition(address _user) view returns (bool)",
  "function getCapProgress(address _user, uint256 _stakeId) view returns (uint256 harvested, uint256 cap)",
];

const AffiliateABI = [
  "function getDirectReferrals(address _user) view returns (address[])",
  "function getTeamVolume(address _user) view returns (uint256)",
  "function teamVolume(address) view returns (uint256)",
  "function getAllIncome(address _user) view returns (uint256, uint256, uint256)",
  "function getUserRankInfo(address _user) view returns (uint256, uint256, uint256, uint256, uint256)",
  "function getUnlockedLevels(address _user) view returns (uint256)",
  "function referrerOf(address) view returns (address)",
  "function directDividends(address) view returns (uint256)",
  "function teamDividends(address) view returns (uint256)",
  "function rankDividends(address) view returns (uint256)",
  "function getTotalHarvestable(address _user) view returns (uint256)",
  "function getUpline(address _user, uint256 _levels) view returns (address[])",
  "function isRegistered(address) view returns (bool)",
  "event TeamEarned(address indexed upline, address indexed staker, uint256 level, uint256 amount)",
  "event DirectEarned(address indexed referrer, uint256 amount)",
  "event Harvested(address indexed user, uint8 incomeType, uint256 usdAmount, uint256 kairoAmount)",
];

const ERC20ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
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
  const wallet = new ethers.Wallet(DEBUG_PRIVATE_KEY, provider);
  const userAddr = wallet.address;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  KAIRO DAO — Full User Data Debug");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  User Address : ${userAddr}`);
  console.log(`  RPC          : ${RPC}`);
  console.log(`  Network      : opBNB Testnet (5611)`);
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

  // ── 2. REGISTRATION & UPLINE ──
  console.log("─── 2. REGISTRATION & UPLINE ─────────────────────────────");
  try {
    const referrer = await affiliate.referrerOf(userAddr);
    console.log(`  Registered: ${referrer !== ethers.ZeroAddress}`);
    console.log(`  Referrer  : ${referrer}`);
  } catch (e: any) { console.log(`  referrerOf error: ${e.message?.slice(0, 100)}`); }
  try {
    const upline = await affiliate.getUpline(userAddr, 5n);
    console.log(`  Upline (5): ${upline.length > 0 ? upline.join(" → ") : "(none)"}`);
  } catch { console.log(`  Upline    : (error fetching)`); }
  console.log();

  // ── 3. STAKING DATA ──
  console.log("─── 3. STAKING DATA ──────────────────────────────────────");
  const totalActiveVal = await staking.getTotalActiveStakeValue(userAddr);
  const hasActive = await staking.hasActivePosition(userAddr);
  const remainingCap = await staking.getRemainingCap(userAddr);
  console.log(`  Total Active Stake Value : ${fmtUsd(totalActiveVal)}`);
  console.log(`  Has Active Position      : ${hasActive}`);
  console.log(`  Remaining 3X Cap         : ${fmtUsd(remainingCap)}`);

  // Enumerate individual stakes
  let stakeIdx = 0;
  while (true) {
    try {
      const s = await staking.userStakes(userAddr, stakeIdx);
      console.log(`\n  Stake #${stakeIdx}:`);
      console.log(`    Amount (current)   : ${fmtUsd(s.amount)}`);
      console.log(`    Original Amount    : ${fmtUsd(s.originalAmount)}`);
      console.log(`    Active             : ${s.active}`);
      console.log(`    Tier               : ${["Bronze", "Silver", "Gold"][s.tier] || s.tier}`);
      console.log(`    Start Time         : ${new Date(Number(s.startTime) * 1000).toISOString()}`);
      console.log(`    Last Compound      : ${new Date(Number(s.lastCompoundTime) * 1000).toISOString()}`);
      console.log(`    Compound Earned    : ${fmtUsd(s.compoundEarned)}`);
      console.log(`    Harvested Rewards  : ${fmtUsd(s.harvestedRewards)}`);
      console.log(`    Total Earned (cap) : ${fmtUsd(s.totalEarned)}`);
      const cap = s.originalAmount * 3n;
      console.log(`    3X Cap Limit       : ${fmtUsd(cap)}`);
      console.log(`    Cap Progress       : ${cap > 0n ? ((Number(s.totalEarned) / Number(cap)) * 100).toFixed(2) : 0}%`);
      try {
        const cp = await staking.getCapProgress(userAddr, stakeIdx);
        console.log(`    getCapProgress     : harvested=${fmtUsd(cp.harvested)}, cap=${fmtUsd(cp.cap)}`);
      } catch {}
      stakeIdx++;
    } catch {
      break;
    }
  }
  console.log(`\n  Total stakes found: ${stakeIdx}`);
  console.log();

  // ── 4. AFFILIATE INCOME ──
  console.log("─── 4. AFFILIATE INCOME ──────────────────────────────────");
  const [directDiv, teamDiv, rankDiv] = await Promise.all([
    affiliate.directDividends(userAddr),
    affiliate.teamDividends(userAddr),
    affiliate.rankDividends(userAddr),
  ]);
  console.log(`  Direct Dividends (raw) : ${fmtUsd(directDiv)}`);
  console.log(`  Team Dividends (raw)   : ${fmtUsd(teamDiv)}`);
  console.log(`  Rank Dividends (raw)   : ${fmtUsd(rankDiv)}`);

  try {
    const allIncome = await affiliate.getAllIncome(userAddr);
    console.log(`  getAllIncome(direct)   : ${fmtUsd(allIncome[0])}`);
    console.log(`  getAllIncome(team)     : ${fmtUsd(allIncome[1])}`);
    console.log(`  getAllIncome(rank)     : ${fmtUsd(allIncome[2])}`);
  } catch (e: any) { console.log(`  getAllIncome error: ${e.message}`); }

  try {
    const harvestable = await affiliate.getTotalHarvestable(userAddr);
    console.log(`  Total Harvestable      : ${fmtUsd(harvestable)}`);
  } catch (e: any) { console.log(`  getTotalHarvestable error: ${e.message}`); }
  console.log();

  // ── 5. RANK INFO ──
  console.log("─── 5. RANK INFO ─────────────────────────────────────────");
  try {
    const ri = await affiliate.getUserRankInfo(userAddr);
    console.log(`  Stored Rank  : ${RANK_NAMES[Number(ri[0])] || ri[0]} (${ri[0]})`);
    console.log(`  Live Rank    : ${RANK_NAMES[Number(ri[1])] || ri[1]} (${ri[1]})`);
    console.log(`  Salary       : ${fmtUsd(ri[2])}`);
    console.log(`  Last Claimed : ${Number(ri[3]) > 0 ? new Date(Number(ri[3]) * 1000).toISOString() : "never"}`);
    console.log(`  Next Claim   : ${Number(ri[4]) > 0 ? new Date(Number(ri[4]) * 1000).toISOString() : "n/a"}`);
  } catch (e: any) { console.log(`  Error: ${e.message}`); }
  console.log();

  // ── 6. TEAM VOLUME & UNLOCKED LEVELS ──
  console.log("─── 6. TEAM VOLUME & LEVELS ──────────────────────────────");
  const teamVol = await affiliate.getTeamVolume(userAddr);
  const unlockedLvls = await affiliate.getUnlockedLevels(userAddr);
  console.log(`  Team Volume      : ${fmtUsd(teamVol)}`);
  console.log(`  Unlocked Levels  : ${unlockedLvls}`);
  console.log();

  // ── 7. DIRECT REFERRALS & DIRECT BUSINESS ──
  console.log("─── 7. DIRECT REFERRALS ──────────────────────────────────");
  const directRefs: string[] = await affiliate.getDirectReferrals(userAddr);
  console.log(`  Direct Referral Count: ${directRefs.length}`);

  let directBusiness = 0n;
  let directActive = 0;
  for (let i = 0; i < directRefs.length; i++) {
    const ref = directRefs[i];
    const activeVal = await staking.getTotalActiveStakeValue(ref);
    const refTeamVol = await affiliate.teamVolume(ref);
    const isActive = activeVal > 0n;
    if (isActive) directActive++;
    directBusiness += activeVal;

    console.log(`\n  Referral #${i + 1}: ${ref}`);
    console.log(`    Active Stake Value : ${fmtUsd(activeVal)} ${isActive ? "✅" : "❌"}`);
    console.log(`    Team Volume (leg)  : ${fmtUsd(refTeamVol)}`);
  }
  console.log(`\n  ══════════════════════════════════════════`);
  console.log(`  DIRECT BUSINESS (sum of active stakes)  : ${fmtUsd(directBusiness)}`);
  console.log(`  Active Direct Referrals                 : ${directActive} / ${directRefs.length}`);
  console.log();

  // ── 8. BFS TEAM TREE (Levels 1-15) ──
  console.log("─── 8. TEAM TREE (BFS Levels 1-15) ──────────────────────");
  let currentLevel = [...directRefs];
  let totalTeamSize = 0;
  let activeTeamStakes = 0;

  for (let lvl = 1; lvl <= 15 && currentLevel.length > 0; lvl++) {
    let levelBiz = 0n;
    let levelActive = 0;
    const nextLevel: string[] = [];

    for (const addr of currentLevel) {
      const val = await staking.getTotalActiveStakeValue(addr);
      levelBiz += val;
      if (val > 0n) { levelActive++; activeTeamStakes++; }
      totalTeamSize++;

      // Get their referrals for next level
      try {
        const subs: string[] = await affiliate.getDirectReferrals(addr);
        nextLevel.push(...subs);
      } catch {}
    }

    console.log(`  Level ${String(lvl).padStart(2)}: ${currentLevel.length} members, Business: ${fmtUsd(levelBiz)}, Active: ${levelActive}`);
    currentLevel = nextLevel;
  }

  // Continue BFS beyond level 15 for total count
  while (currentLevel.length > 0) {
    totalTeamSize += currentLevel.length;
    const nextLevel: string[] = [];
    for (const addr of currentLevel) {
      try {
        const subs: string[] = await affiliate.getDirectReferrals(addr);
        nextLevel.push(...subs);
      } catch {}
    }
    currentLevel = nextLevel;
  }

  console.log(`\n  Total Team Size     : ${totalTeamSize}`);
  console.log(`  Active Team Stakes  : ${activeTeamStakes}`);
  console.log();

  // ── 9. FRONTEND vs CONTRACT COMPARISON ──
  console.log("─── 9. FRONTEND vs CONTRACT COMPARISON ───────────────────");
  console.log(`  Contract teamVolume (getTeamVolume) : ${fmtUsd(teamVol)}`);
  console.log(`  Frontend Direct Business (calc)     : ${fmtUsd(directBusiness)}`);
  console.log(`  Frontend Team Business (teamVolume) : ${fmtUsd(teamVol)}`);
  console.log(`  Contract totalActiveStakeValue      : ${fmtUsd(totalActiveVal)}`);
  console.log(`  Note: Direct Business = sum of getTotalActiveStakeValue for direct referrals`);
  console.log(`  Note: Team Business   = getTeamVolume (all downstream stake volume, NOT self)`);
  console.log();

  // ── 10. EVENT LOG ANALYSIS ──
  console.log("─── 10. RECENT EVENTS ────────────────────────────────────");
  try {
    const directFilter = affiliate.filters.DirectEarned(userAddr);
    const directEvents = await affiliate.queryFilter(directFilter, 0);
    console.log(`  DirectEarned events: ${directEvents.length}`);
    for (const ev of directEvents.slice(-5)) {
      const args = (ev as any).args;
      console.log(`    Block ${ev.blockNumber}: ${fmtUsd(args[1])}`);
    }
  } catch (e: any) { console.log(`  DirectEarned query error: ${e.message}`); }

  try {
    const teamFilter = affiliate.filters.TeamEarned(userAddr);
    const teamEvents = await affiliate.queryFilter(teamFilter, 0);
    console.log(`  TeamEarned events: ${teamEvents.length}`);
    for (const ev of teamEvents.slice(-5)) {
      const args = (ev as any).args;
      console.log(`    Block ${ev.blockNumber}: staker=${args[1]}, level=${args[2]}, amount=${fmtUsd(args[3])}`);
    }
  } catch (e: any) { console.log(`  TeamEarned query error: ${e.message}`); }

  try {
    const harvestFilter = affiliate.filters.Harvested(userAddr);
    const harvestEvents = await affiliate.queryFilter(harvestFilter, 0);
    console.log(`  Harvested events: ${harvestEvents.length}`);
    const incomeTypes = ["Direct", "Team", "Rank"];
    for (const ev of harvestEvents.slice(-5)) {
      const args = (ev as any).args;
      console.log(`    Block ${ev.blockNumber}: type=${incomeTypes[Number(args[1])] || args[1]}, usd=${fmtUsd(args[2])}, kairo=${formatUnits(args[3], 18)}`);
    }
  } catch (e: any) { console.log(`  Harvested query error: ${e.message}`); }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DEBUG COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
