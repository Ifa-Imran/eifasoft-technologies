/**
 * Debug Rank Salary Auto-Accrual
 *
 * Uses L1 wallet to inspect why rank salary is not auto-crediting in testing.
 * Checks: rank level, team volume, lastRankClaimTime, pending salary,
 * RANK_INTERVAL, elapsed time, and attempts a checkRankChange if needed.
 *
 * Usage: npx hardhat run scripts/debug-rank-salary.ts --network opbnbTestnet
 */
import { ethers } from "hardhat";

const AFFILIATE_DISTRIBUTOR = "0x69Fe3f1c1D347412dAf7835C2eA490d12b964d69";
const STAKING_MANAGER       = "0x35F95D1cC8933596d7B3fcc4328D1E1d39Def8F5";

const L1_KEY = "edea0b8af9080af0e04a95a59e68b5236fb9ebd911833bda712ea709a0348a38";
const L2_KEY = "0ae0e3d497e3a4b330b363e9b3a3cacbe7e457ba1114dd68990853b9cd2ffb64";

async function main() {
  const provider = ethers.provider;
  const l1 = new ethers.Wallet(L1_KEY, provider);
  const l2 = new ethers.Wallet(L2_KEY, provider);

  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);

  const now = Math.floor(Date.now() / 1000);
  const block = await provider.getBlock("latest");
  const blockTime = block!.timestamp;

  console.log("=== RANK SALARY DEBUG ===");
  console.log(`Current time (local): ${new Date().toISOString()}`);
  console.log(`Block timestamp:      ${blockTime} (${new Date(blockTime * 1000).toISOString()})`);
  console.log(`RANK_INTERVAL:        ${await ad.RANK_INTERVAL()} seconds (${Number(await ad.RANK_INTERVAL()) / 3600} hours)`);
  console.log("");

  for (const [label, wallet] of [["L1", l1], ["L2", l2]] as const) {
    const addr = wallet.address;
    console.log(`--- ${label}: ${addr} ---`);

    // 1. Check registration
    const referrer = await ad.referrerOf(addr);
    console.log(`  referrerOf:           ${referrer}`);
    if (referrer === ethers.ZeroAddress) {
      console.log(`  ⚠️  NOT REGISTERED in referral tree!`);
      console.log("");
      continue;
    }

    // 2. Team volume
    const teamVol = await ad.teamVolume(addr);
    console.log(`  teamVolume:           ${ethers.formatEther(teamVol)} USD`);

    // 3. Direct referrals count
    const directCount = await ad.directCount(addr);
    console.log(`  directCount:          ${directCount}`);

    // 4. Active stake check
    const hasActive = await sm.hasActivePosition(addr);
    const activeStakeVal = await sm.getTotalActiveStakeValue(addr);
    console.log(`  hasActivePosition:    ${hasActive}`);
    console.log(`  totalActiveStake:     $${ethers.formatEther(activeStakeVal)}`);

    // 5. Stored rank & live rank
    const storedRank = await ad.userRankLevel(addr);
    console.log(`  storedRank (on-chain): ${storedRank}`);

    // 6. _determineRankLevel (what rank they qualify for now)
    const rankInfo = await ad.getUserRankInfo(addr);
    const liveRank = rankInfo[1];
    const salary = rankInfo[2];
    const lastClaimed = rankInfo[3];
    const nextClaimTime = rankInfo[4];
    const pendingSalary = rankInfo[5];
    const totalHarvestable = rankInfo[6];

    console.log(`  liveRank (computed):  ${liveRank}`);
    console.log(`  salary/period:        $${ethers.formatEther(salary)}`);
    console.log(`  lastRankClaimTime:    ${lastClaimed} (${lastClaimed > 0n ? new Date(Number(lastClaimed) * 1000).toISOString() : 'NEVER SET'})`);
    console.log(`  nextClaimTime:        ${nextClaimTime} (${nextClaimTime > 0n ? new Date(Number(nextClaimTime) * 1000).toISOString() : 'N/A'})`);

    // 7. Time analysis
    if (lastClaimed > 0n) {
      const elapsed = BigInt(blockTime) - lastClaimed;
      const rankInterval = await ad.RANK_INTERVAL();
      const periods = elapsed / rankInterval;
      console.log(`  elapsed since last:   ${elapsed} seconds (${Number(elapsed) / 3600} hours)`);
      console.log(`  periods elapsed:      ${periods}`);
      console.log(`  pendingSalary:        $${ethers.formatEther(pendingSalary)}`);
    } else {
      console.log(`  ⚠️  lastRankClaimTime is 0 — timer never started!`);
    }

    // 8. rankDividends (accrued, excluding pending)
    const rankDiv = await ad.rankDividends(addr);
    console.log(`  rankDividends (accrued): $${ethers.formatEther(rankDiv)}`);
    console.log(`  totalRankHarvestable: $${ethers.formatEther(totalHarvestable)}`);

    // 9. All income
    const allIncome = await ad.getAllIncome(addr);
    console.log(`  allIncome: direct=$${ethers.formatEther(allIncome[0])}, team=$${ethers.formatEther(allIncome[1])}, rank=$${ethers.formatEther(allIncome[2])}`);

    // 10. 50% max-leg rule analysis
    if (teamVol > 0n) {
      // Find largest leg
      const referrals = await ad.directReferrals(addr, 0).catch(() => null);
      // Get all direct referrals
      let largestLeg = 0n;
      let legCount = 0;
      try {
        for (let i = 0; i < 50; i++) {
          try {
            const ref = await ad.directReferrals(addr, i);
            const legVol = await ad.teamVolume(ref);
            if (legVol > largestLeg) largestLeg = legVol;
            legCount++;
          } catch {
            break;
          }
        }
      } catch {}

      const maxLeg = teamVol / 2n;
      const adjustedVol = largestLeg > maxLeg
        ? teamVol - largestLeg + maxLeg
        : teamVol;

      console.log(`  --- 50% Max-Leg Rule ---`);
      console.log(`  legs found:           ${legCount}`);
      console.log(`  largestLeg:           $${ethers.formatEther(largestLeg)}`);
      console.log(`  maxLeg (50%):         $${ethers.formatEther(maxLeg)}`);
      console.log(`  adjustedVolume:       $${ethers.formatEther(adjustedVol)}`);
      console.log(`  isCapped:             ${largestLeg > maxLeg}`);

      // Check rank thresholds
      const thresholds = [];
      for (let i = 0; i < 10; i++) {
        thresholds.push(await ad.RANK_THRESHOLDS(i));
      }
      console.log(`  --- Rank Thresholds ---`);
      for (let i = 0; i < 10; i++) {
        const met = adjustedVol >= thresholds[i];
        console.log(`    Rank ${i + 1}: $${ethers.formatEther(thresholds[i])} ${met ? '✅ MET' : '❌ NOT MET'}`);
        if (!met) break;
      }
    }

    // DIAGNOSIS
    console.log("");
    console.log(`  === DIAGNOSIS ===`);
    if (storedRank === 0n && liveRank === 0n) {
      console.log(`  ❌ User has NO rank (team volume too low for Rank 1 threshold of $10,000)`);
      console.log(`     No salary will accrue.`);
    } else if (storedRank === 0n && liveRank > 0n) {
      console.log(`  ⚠️  storedRank=0 but liveRank=${liveRank}. Need to call checkRankChange() to initialize rank.`);
      console.log(`     The timer only starts after checkRankChange sets storedRank and lastRankClaimTime.`);
    } else if (lastClaimed === 0n) {
      console.log(`  ⚠️  storedRank=${storedRank} but lastRankClaimTime=0. Timer was never initialized!`);
    } else if (pendingSalary === 0n) {
      const elapsed = BigInt(blockTime) - lastClaimed;
      const rankInterval = await ad.RANK_INTERVAL();
      console.log(`  ℹ️  No pending salary. Elapsed: ${elapsed}s, need ${rankInterval}s per period.`);
      console.log(`     Wait ${Number(rankInterval - elapsed)} more seconds for next accrual.`);
    } else {
      console.log(`  ✅ Salary IS accruing. Pending: $${ethers.formatEther(pendingSalary)}`);
      console.log(`     Total harvestable (rank): $${ethers.formatEther(totalHarvestable)}`);
    }
    console.log("");
  }

  // === ATTEMPT FIX: Call checkRankChange for both wallets if needed ===
  console.log("=== ATTEMPTING checkRankChange FOR BOTH WALLETS ===");
  const [deployer] = await ethers.getSigners();

  for (const [label, wallet] of [["L1", l1], ["L2", l2]] as const) {
    const addr = wallet.address;
    const storedRank = await ad.userRankLevel(addr);
    const rankInfo = await ad.getUserRankInfo(addr);
    const liveRank = rankInfo[1];

    if (storedRank === 0n && liveRank === 0n) {
      console.log(`${label}: No rank eligible, skipping.`);
      continue;
    }

    if (storedRank !== liveRank || (await ad.lastRankClaimTime(addr)) === 0n) {
      console.log(`${label}: Calling checkRankChange(${addr})...`);
      try {
        const tx = await (ad.connect(deployer) as any).checkRankChange(addr);
        const receipt = await tx.wait();
        console.log(`  ✅ tx: ${receipt!.hash}`);

        // Re-read state after
        const newRankInfo = await ad.getUserRankInfo(addr);
        console.log(`  storedRank now: ${newRankInfo[0]}, lastClaimTime: ${newRankInfo[3]}`);
      } catch (err: any) {
        console.log(`  ❌ Failed: ${err.message?.slice(0, 200)}`);
      }
    } else {
      console.log(`${label}: Rank is synced (stored=${storedRank}, live=${liveRank}), timer set. Salary should be accruing.`);
    }
  }

  // Final state after fixes
  console.log("\n=== FINAL STATE AFTER FIX ===");
  for (const [label, wallet] of [["L1", l1], ["L2", l2]] as const) {
    const info = await ad.getUserRankInfo(wallet.address);
    console.log(`${label}: storedRank=${info[0]}, liveRank=${info[1]}, salary=$${ethers.formatEther(info[2])}/period, lastClaim=${info[3]}, pending=$${ethers.formatEther(info[5])}, totalHarvestable=$${ethers.formatEther(info[6])}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
