import { ethers, formatUnits } from "ethers";
import "dotenv/config";

// ── Target wallet ──
const TARGET_WALLET = "0xD3B8D78c447c64ebB1D9815aBB1019Ea2CBa74Fb";

// ── Contract addresses (opBNB Mainnet) ──
const STAKING_MANAGER = "0x21c22de855e87B2124A50d76f31E79152C977090";
const AFFILIATE_DIST  = "0x8C7FF618C0Bc7ae9b9fd2828Ba33d977edb99237";
const KAIRO_TOKEN     = "0x8D01409fB9Adc19F5f1Fb7eD47c12D5A88051AeD";
const USDT_TOKEN      = "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3";

const USDT_DECIMALS = 18;
const RPC = process.env.OPBNB_MAINNET_RPC || "https://opbnb-mainnet-rpc.bnbchain.org";

// ── Minimal ABIs ──
const StakingABI = [
  "function getTotalActiveStakeValue(address _user) view returns (uint256)",
  "function userStakes(address, uint256) view returns (uint256 amount, uint256 originalAmount, uint256 startTime, uint256 lastCompoundTime, uint256 harvestedRewards, uint256 totalEarned, uint256 compoundEarned, bool active, uint8 tier)",
  "function totalActiveStakeValue(address) view returns (uint256)",
  "function getRemainingCap(address _user) view returns (uint256)",
  "function hasActivePosition(address _user) view returns (bool)",
  "function getCapProgress(address _user, uint256 _stakeId) view returns (uint256 harvested, uint256 cap)",
  "function getUserStakes(address _user) view returns (tuple(uint256 amount, uint256 originalAmount, uint256 startTime, uint256 lastCompoundTime, uint256 harvestedRewards, uint256 totalEarned, uint256 compoundEarned, bool active, uint8 tier)[])",
];

const AffiliateABI = [
  "function referrerOf(address) view returns (address)",
  "function isRegistered(address) view returns (bool)",
  "function getTeamVolume(address _user) view returns (uint256)",
];

const ERC20ABI = [
  "function balanceOf(address) view returns (uint256)",
];

function fmtUsd(val: bigint): string {
  return `$${Number(formatUnits(val, USDT_DECIMALS)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const userAddr = TARGET_WALLET;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  KAIRO DAO — Active Stake Debug");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Wallet       : ${userAddr}`);
  console.log(`  RPC          : ${RPC}`);
  console.log(`  Network      : opBNB Mainnet (204)`);
  console.log(`  Staking Mgr  : ${STAKING_MANAGER}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const staking = new ethers.Contract(STAKING_MANAGER, StakingABI, provider);
  const affiliate = new ethers.Contract(AFFILIATE_DIST, AffiliateABI, provider);
  const usdt = new ethers.Contract(USDT_TOKEN, ERC20ABI, provider);
  const kairo = new ethers.Contract(KAIRO_TOKEN, ERC20ABI, provider);

  // ── 1. WALLET BALANCES ──
  console.log("─── 1. WALLET BALANCES ───────────────────────────────────");
  try {
    const [bnbBal, usdtBal, kairoBal] = await Promise.all([
      provider.getBalance(userAddr),
      usdt.balanceOf(userAddr),
      kairo.balanceOf(userAddr),
    ]);
    console.log(`  BNB   : ${formatUnits(bnbBal, 18)}`);
    console.log(`  USDT  : ${fmtUsd(usdtBal)}`);
    console.log(`  KAIRO : ${formatUnits(kairoBal, 18)}`);
  } catch (e: any) {
    console.log(`  Error fetching balances: ${e.message}`);
  }
  console.log();

  // ── 2. REGISTRATION CHECK ──
  console.log("─── 2. REGISTRATION STATUS ───────────────────────────────");
  try {
    const isRegistered = await affiliate.isRegistered(userAddr);
    const referrer = await affiliate.referrerOf(userAddr);
    console.log(`  Is Registered : ${isRegistered}`);
    console.log(`  Referrer      : ${referrer}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
  console.log();

  // ── 3. STAKING SUMMARY ──
  console.log("─── 3. STAKING SUMMARY ───────────────────────────────────");
  try {
    const totalActiveVal = await staking.getTotalActiveStakeValue(userAddr);
    console.log(`  getTotalActiveStakeValue : ${fmtUsd(totalActiveVal)}`);
  } catch (e: any) {
    console.log(`  getTotalActiveStakeValue ERROR: ${e.message}`);
  }

  try {
    const mappingVal = await staking.totalActiveStakeValue(userAddr);
    console.log(`  totalActiveStakeValue (mapping) : ${fmtUsd(mappingVal)}`);
  } catch (e: any) {
    console.log(`  totalActiveStakeValue mapping ERROR: ${e.message}`);
  }

  try {
    const hasActive = await staking.hasActivePosition(userAddr);
    console.log(`  hasActivePosition : ${hasActive}`);
  } catch (e: any) {
    console.log(`  hasActivePosition ERROR: ${e.message}`);
  }

  try {
    const remainingCap = await staking.getRemainingCap(userAddr);
    console.log(`  getRemainingCap   : ${fmtUsd(remainingCap)}`);
  } catch (e: any) {
    console.log(`  getRemainingCap ERROR: ${e.message}`);
  }
  console.log();

  // ── 4. ENUMERATE INDIVIDUAL STAKES ──
  console.log("─── 4. INDIVIDUAL STAKES (via userStakes mapping) ────────");
  let stakeIdx = 0;
  let totalActive = 0;
  let totalInactive = 0;

  while (true) {
    try {
      const s = await staking.userStakes(userAddr, stakeIdx);
      const tierName = ["Bronze", "Silver", "Gold"][Number(s.tier)] || `Unknown(${s.tier})`;
      const isActive = s.active;
      if (isActive) totalActive++;
      else totalInactive++;

      console.log(`\n  Stake #${stakeIdx}:`);
      console.log(`    Active             : ${isActive ? "✅ YES" : "❌ NO"}`);
      console.log(`    Tier               : ${tierName}`);
      console.log(`    Amount (current)   : ${fmtUsd(s.amount)}`);
      console.log(`    Original Amount    : ${fmtUsd(s.originalAmount)}`);
      console.log(`    Start Time         : ${new Date(Number(s.startTime) * 1000).toISOString()}`);
      console.log(`    Last Compound      : ${new Date(Number(s.lastCompoundTime) * 1000).toISOString()}`);
      console.log(`    Compound Earned    : ${fmtUsd(s.compoundEarned)}`);
      console.log(`    Harvested Rewards  : ${fmtUsd(s.harvestedRewards)}`);
      console.log(`    Total Earned       : ${fmtUsd(s.totalEarned)}`);
      const cap = s.originalAmount * 3n;
      console.log(`    3X Cap Limit       : ${fmtUsd(cap)}`);
      const capPct = cap > 0n ? ((Number(s.totalEarned) / Number(cap)) * 100).toFixed(2) : "0";
      console.log(`    Cap Progress       : ${capPct}%`);

      try {
        const cp = await staking.getCapProgress(userAddr, stakeIdx);
        console.log(`    getCapProgress()   : harvested=${fmtUsd(cp.harvested)}, cap=${fmtUsd(cp.cap)}`);
      } catch {}

      stakeIdx++;
    } catch {
      break;
    }
  }

  console.log(`\n  ══════════════════════════════════════════`);
  console.log(`  Total Stakes Found   : ${stakeIdx}`);
  console.log(`  Active Stakes        : ${totalActive}`);
  console.log(`  Inactive Stakes      : ${totalInactive}`);
  console.log();

  // ── 5. TRY getUserStakes (array getter) ──
  console.log("─── 5. getUserStakes (array getter) ──────────────────────");
  try {
    const allStakes = await staking.getUserStakes(userAddr);
    console.log(`  getUserStakes returned ${allStakes.length} stakes`);
    for (let i = 0; i < allStakes.length; i++) {
      const s = allStakes[i];
      console.log(`    [${i}] active=${s.active}, amount=${fmtUsd(s.amount)}, original=${fmtUsd(s.originalAmount)}, tier=${s.tier}`);
    }
  } catch (e: any) {
    console.log(`  getUserStakes not available or error: ${e.message?.slice(0, 150)}`);
  }
  console.log();

  // ── 6. TEAM VOLUME (confirms staking is recognized by affiliate system) ──
  console.log("─── 6. TEAM VOLUME CHECK ─────────────────────────────────");
  try {
    const teamVol = await affiliate.getTeamVolume(userAddr);
    console.log(`  Team Volume : ${fmtUsd(teamVol)}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DEBUG COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
