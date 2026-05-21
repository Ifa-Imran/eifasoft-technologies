/**
 * check-staking-profit.ts
 *
 * Cross-checks the staking profit shown in the frontend vs the backend
 * vs the actual on-chain state for a single wallet.
 *
 *   Source 1: On-chain  -> StakingManager.getUserStakes(wallet)
 *   Source 2: Frontend  -> recomputed locally using the EXACT logic from
 *                          frontend/src/hooks/useUserStakes.ts
 *                          (calcPendingProfit + harvestable + totalEarned)
 *   Source 3: Backend   -> GET https://dev.kairodao.com/api/v1/user/<wallet>/dashboard
 *
 * Run:
 *   npx ts-node scripts/check-staking-profit.ts 0x8498835c2EC0eab789997bE99542fb831d33CE57
 *
 * (defaults to that wallet if no arg is given)
 */

import { ethers, formatUnits } from 'ethers';
import 'dotenv/config';

// ─── Network / contract config (opBNB Testnet, kairo-testnet stack) ─────────
const RPC_URL = process.env.OPBNB_TESTNET_RPC || 'https://opbnb-testnet-rpc.bnbchain.org';
const STAKING_MANAGER = '0x5eADF2F4Ac87EAa2fAA5aBCA74BBab98bC7B843f';
const AFFILIATE_DISTRIBUTOR = '0x530Ade1d4E3E757214E3E2bc0633b973621216F9';
const BACKEND_URL = process.env.BACKEND_URL || 'https://dev.kairodao.com';
const USDT_DECIMALS = 18;

// Mirror `STAKING_TIERS` in frontend/src/config/contracts.ts (IS_TESTNET branch).
// Tier 0 = Bronze (180s), Tier 1 = Silver (120s), Tier 2 = Gold (60s).
const TIERS = [
  { name: 'Bronze', compoundInterval: 180 },
  { name: 'Silver', compoundInterval: 120 },
  { name: 'Gold',   compoundInterval: 60  },
] as const;

// ─── ABIs (just the bits we need) ───────────────────────────────────────────
const StakingABI = [
  'function getUserStakeCount(address) view returns (uint256)',
  'function getUserStakes(address) view returns (tuple(uint256 amount, uint256 originalAmount, uint256 startTime, uint256 lastCompoundTime, uint256 harvestedRewards, uint256 totalEarned, uint256 compoundEarned, bool active, uint8 tier)[])',
  'function getTotalActiveStakeValue(address) view returns (uint256)',
];

const AffiliateABI = [
  'function getAllIncome(address) view returns (uint256, uint256, uint256)',
  'function isRegistered(address) view returns (bool)',
];

// ─── Frontend math (verbatim from useUserStakes.ts) ─────────────────────────
function calcPendingProfit(
  amount: bigint,
  lastCompoundTime: number,
  compoundInterval: number,
  now: number,
): bigint {
  const elapsed = now - lastCompoundTime;
  const intervals = Math.floor(elapsed / compoundInterval);
  if (intervals <= 0) return 0n;
  let currentAmount = amount;
  let totalProfit = 0n;
  for (let i = 0; i < intervals; i++) {
    const profit = (currentAmount * 15n) / 10000n; // 0.15% per interval
    currentAmount += profit;
    totalProfit += profit;
  }
  return totalProfit;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (v: bigint) =>
  Number(formatUnits(v, USDT_DECIMALS)).toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

const banner = (s: string) => {
  const line = '─'.repeat(78);
  console.log(`\n${line}\n  ${s}\n${line}`);
};

async function main() {
  const wallet = (process.argv[2] || '0x8498835c2EC0eab789997bE99542fb831d33CE57').toLowerCase();
  if (!ethers.isAddress(wallet)) {
    console.error(`Invalid address: ${wallet}`);
    process.exit(1);
  }

  banner(`Staking profit cross-check for ${wallet}`);
  console.log(`  RPC:             ${RPC_URL}`);
  console.log(`  StakingManager:  ${STAKING_MANAGER}`);
  console.log(`  Backend:         ${BACKEND_URL}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const sm = new ethers.Contract(STAKING_MANAGER, StakingABI, provider);
  const ad = new ethers.Contract(AFFILIATE_DISTRIBUTOR, AffiliateABI, provider);

  // ── 1. ON-CHAIN ──────────────────────────────────────────────────────────
  banner('1. ON-CHAIN  (StakingManager.getUserStakes)');
  const block = await provider.getBlock('latest');
  const now = block!.timestamp;
  console.log(`  Latest block: ${block!.number}   timestamp: ${now}\n`);

  const rawStakes: any[] = await sm.getUserStakes(wallet);
  const totalActiveOnchain: bigint = await sm.getTotalActiveStakeValue(wallet);

  if (rawStakes.length === 0) {
    console.log('  No stakes on-chain for this wallet.');
  }

  let registered = false;
  try { registered = await ad.isRegistered(wallet); } catch {}
  console.log(`  Registered in AffiliateDistributor: ${registered}`);
  console.log(`  totalActiveStakeValue (on-chain):   ${fmt(totalActiveOnchain)} USDT`);

  // ── 2. FRONTEND-EQUIVALENT computation ───────────────────────────────────
  banner('2. FRONTEND  (recomputed using useUserStakes.ts logic)');

  let feTotalOriginal = 0n;
  let feTotalCurrentAmount = 0n;
  let feTotalCompoundEarned = 0n;
  let feTotalHarvested = 0n;
  let feTotalCapEarned = 0n;
  let feTotalHardCap = 0n;
  let feHarvestableConfirmed = 0n;
  let fePendingProfit = 0n;

  console.log(
    `  idx  active  tier      amount         original      compEarned   harvested   totalEarned   harvestable   pendingNow   nextIn`,
  );
  console.log(
    `  ───  ──────  ────────  ─────────────  ────────────  ───────────  ──────────  ────────────  ────────────  ───────────  ───────`,
  );

  rawStakes.forEach((s: any, i: number) => {
    const amount = BigInt(s.amount);
    const original = BigInt(s.originalAmount);
    const compoundEarned = BigInt(s.compoundEarned);
    const harvested = BigInt(s.harvestedRewards);
    const totalEarned = BigInt(s.totalEarned);
    const lastCompound = Number(s.lastCompoundTime);
    const tierIdx = Number(s.tier);
    const tier = TIERS[tierIdx] || TIERS[0];
    const active = Boolean(s.active);
    const harvestable = compoundEarned > harvested ? compoundEarned - harvested : 0n;
    const hardCap = original * 3n;
    const pending = calcPendingProfit(amount, lastCompound, tier.compoundInterval, now);
    const elapsed = now - lastCompound;
    const nextIn = Math.max(0, tier.compoundInterval - (elapsed % tier.compoundInterval));

    if (active) {
      feTotalOriginal += original;
      feTotalCurrentAmount += amount;
      feTotalCompoundEarned += compoundEarned;
      feTotalHarvested += harvested;
      feTotalCapEarned += totalEarned;
      feTotalHardCap += hardCap;
      feHarvestableConfirmed += harvestable;
      fePendingProfit += pending;
    }

    console.log(
      `  ${String(i).padStart(3)}  ${active ? ' yes  ' : ' no   '}  ${tier.name.padEnd(7)}  ${fmt(amount).padStart(13)}  ${fmt(original).padStart(12)}  ${fmt(compoundEarned).padStart(11)}  ${fmt(harvested).padStart(10)}  ${fmt(totalEarned).padStart(12)}  ${fmt(harvestable).padStart(12)}  ${fmt(pending).padStart(11)}  ${nextIn}s`,
    );
  });

  const feDisplayHarvestable = feHarvestableConfirmed + fePendingProfit;
  const feDisplayTotalEarned = feDisplayHarvestable + feTotalHarvested;
  const feCapProgress =
    feTotalHardCap > 0n ? Number((feTotalCapEarned * 10000n) / feTotalHardCap) / 100 : 0;

  console.log('');
  console.log(`  totalOriginalAmount (sum of active):  ${fmt(feTotalOriginal)}`);
  console.log(`  totalCurrentAmount  (sum of active):  ${fmt(feTotalCurrentAmount)}`);
  console.log(`  totalCompoundEarned:                  ${fmt(feTotalCompoundEarned)}`);
  console.log(`  totalHarvestedRewards:                ${fmt(feTotalHarvested)}`);
  console.log(`  harvestable (on-chain confirmed):     ${fmt(feHarvestableConfirmed)}`);
  console.log(`  pendingProfit (virtual, since lastCompound): ${fmt(fePendingProfit)}`);
  console.log(`  displayHarvestable  = on-chain + pending: ${fmt(feDisplayHarvestable)}`);
  console.log(`  displayTotalEarned  = displayHarv + harvested: ${fmt(feDisplayTotalEarned)}`);
  console.log(`  cap progress: ${feCapProgress.toFixed(2)}%  (${fmt(feTotalCapEarned)} / ${fmt(feTotalHardCap)})`);

  // Affiliate income (referrals — reported separately by the dashboard).
  let affDirect = 0n, affTeam = 0n, affRank = 0n;
  try {
    const [d, t, r] = await ad.getAllIncome(wallet);
    affDirect = BigInt(d); affTeam = BigInt(t); affRank = BigInt(r);
  } catch (e: any) {
    console.log(`  (getAllIncome failed: ${e.message})`);
  }
  console.log(`  Affiliate income: direct=${fmt(affDirect)}  team=${fmt(affTeam)}  rank=${fmt(affRank)}`);

  // ── 3. BACKEND ───────────────────────────────────────────────────────────
  banner(`3. BACKEND   (GET ${BACKEND_URL}/api/v1/user/${wallet}/dashboard)`);
  let backend: any = null;
  try {
    const resp = await fetch(`${BACKEND_URL}/api/v1/user/${wallet}/dashboard`);
    const text = await resp.text();
    try {
      backend = JSON.parse(text);
    } catch {
      console.log(`  HTTP ${resp.status} (non-JSON body, first 500 chars):`);
      console.log('  ' + text.slice(0, 500));
    }
  } catch (e: any) {
    console.log(`  Fetch failed: ${e.message}`);
  }

  if (backend?.data) {
    const d = backend.data;
    console.log(`  user.totalStakedVolume (DB):    ${d.user?.totalStakedVolume}`);
    console.log(`  user.teamVolume        (DB):    ${d.user?.teamVolume}`);
    console.log(`  user.rankLevel         (DB):    ${d.user?.rankLevel}`);
    console.log(`  stakes.totalActiveValue (DB):   ${d.stakes?.totalActiveValue}`);
    console.log(`  stakes.active.length (DB):      ${d.stakes?.active?.length}`);
    if (d.stakes?.active?.length) {
      console.log(
        `    idx  stakeId  tier  amount        original     totalEarned  harvested   capProgress`,
      );
      d.stakes.active.forEach((s: any, i: number) => {
        console.log(
          `    ${String(i).padStart(3)}  ${String(s.stakeId).padStart(7)}  ${String(s.tier).padStart(4)}  ${String(s.amount).padStart(12)}  ${String(s.originalAmount).padStart(11)}  ${String(s.totalEarned).padStart(11)}  ${String(s.harvestedRewards).padStart(9)}  ${s.capProgress}%`,
        );
      });
    }
    console.log(`  income.direct         (live AD): ${d.income?.direct}`);
    console.log(`  income.team           (live AD): ${d.income?.team}`);
    console.log(`  income.rank           (live AD): ${d.income?.rank}`);
    console.log(`  income.totalHarvestable:         ${d.income?.totalHarvestable}`);
  } else if (backend) {
    console.log(`  Backend response (no .data):`);
    console.log('  ' + JSON.stringify(backend).slice(0, 500));
  }

  // ── 4. DIFF ──────────────────────────────────────────────────────────────
  banner('4. DIFF — frontend vs backend vs on-chain');

  const beTotalActive = backend?.data?.stakes?.totalActiveValue
    ? parseFloat(backend.data.stakes.totalActiveValue)
    : null;
  const onchainActive = Number(formatUnits(totalActiveOnchain, USDT_DECIMALS));
  const feActive = Number(formatUnits(feTotalCurrentAmount, USDT_DECIMALS));

  const fmtN = (n: number | null) =>
    n === null ? 'n/a' : n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  console.log(`  Total active stake value:`);
  console.log(`    on-chain (StakingManager.totalActiveStakeValue):  ${fmtN(onchainActive)}`);
  console.log(`    frontend (Σ stake.amount where active):           ${fmtN(feActive)}`);
  console.log(`    backend  (DB stakes.totalActiveValue):            ${fmtN(beTotalActive)}`);

  if (beTotalActive !== null) {
    const diffBE = Math.abs(feActive - beTotalActive);
    if (diffBE > 0.01) {
      console.log(`  DIFF frontend↔backend totalActive:  ${diffBE.toFixed(4)}  (DB is stale or missing events)`);
    } else {
      console.log(`  Frontend and backend totalActive AGREE within 0.01.`);
    }
  }
  const diffOC = Math.abs(feActive - onchainActive);
  if (diffOC > 0.01) {
    console.log(`  DIFF frontend↔on-chain totalActive:  ${diffOC.toFixed(4)}  (likely rounding of bigint sums)`);
  } else {
    console.log(`  Frontend Σ amount AGREES with on-chain getTotalActiveStakeValue.`);
  }

  // Backend stake-by-stake comparison
  if (backend?.data?.stakes?.active) {
    const beById: Record<string, any> = {};
    backend.data.stakes.active.forEach((s: any) => { beById[String(s.stakeId)] = s; });

    console.log(`\n  Per-stake DB vs on-chain:`);
    console.log(`    stakeId  field           backend (DB)        on-chain`);
    console.log(`    ───────  ─────────────   ─────────────────   ─────────────────`);
    rawStakes.forEach((s: any, i: number) => {
      if (!s.active) return;
      const be = beById[String(i)];
      const ocAmount = Number(formatUnits(BigInt(s.amount), USDT_DECIMALS));
      const ocOriginal = Number(formatUnits(BigInt(s.originalAmount), USDT_DECIMALS));
      const ocTotalEarned = Number(formatUnits(BigInt(s.totalEarned), USDT_DECIMALS));
      const ocHarvested = Number(formatUnits(BigInt(s.harvestedRewards), USDT_DECIMALS));
      const ocTier = Number(s.tier);
      if (!be) {
        console.log(`    ${String(i).padStart(7)}  MISSING IN BACKEND  on-chain amount=${ocAmount}, tier=${ocTier}`);
        return;
      }
      const beAmount = parseFloat(be.amount);
      const beOriginal = parseFloat(be.originalAmount);
      const beTotalEarned = parseFloat(be.totalEarned);
      const beHarvested = parseFloat(be.harvestedRewards);
      const checks: Array<[string, number, number]> = [
        ['amount',         beAmount,       ocAmount],
        ['originalAmount', beOriginal,     ocOriginal],
        ['totalEarned',    beTotalEarned,  ocTotalEarned],
        ['harvested',      beHarvested,    ocHarvested],
        ['tier',           Number(be.tier), ocTier],
      ];
      for (const [name, beV, ocV] of checks) {
        const drift = Math.abs(beV - ocV);
        const flag = drift > 0.01 ? '  ← DRIFT' : '';
        console.log(
          `    ${String(i).padStart(7)}  ${name.padEnd(13)}  ${fmtN(beV).padStart(17)}   ${fmtN(ocV).padStart(17)}${flag}`,
        );
      }
    });
  }

  banner('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
