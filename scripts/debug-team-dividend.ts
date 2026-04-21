/**
 * debug-team-dividend.ts — Focused diagnosis of team dividend issues
 * 
 * Handles RPC timeouts with retry logic and focuses on the first 3 levels
 * of the referral tree to identify blocking conditions.
 */
import { ethers } from "hardhat";

const STAKING_MANAGER = "0xD53Dc5285aC6514bec61d7421247a0E04144394c";
const AFFILIATE_DISTRIBUTOR = "0x022FE670C8870081f9Ff661dd6818339C08B2295";
const TIER_INTERVALS = [900, 600, 300]; // testing: 15m, 10m, 5m

function fmt(val: bigint): string {
  return Number(ethers.formatUnits(val, 18)).toFixed(4);
}
function short(addr: string): string {
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

// Retry wrapper for flaky RPC
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.log(`  [retry ${i + 1}/${retries}] ${err.code || err.message?.slice(0, 40)}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

async function getUserInfo(sm: any, ad: any, addr: string, provider: any) {
  const activeStake = await retry(() => sm.getTotalActiveStakeValue(addr)) as bigint;
  const hasActive = await retry(() => sm.hasActivePosition(addr)) as boolean;
  const stakes = await retry(() => sm.getUserStakes(addr)) as any[];
  const unlockedLevels = await retry(() => ad.getUnlockedLevels(addr)) as bigint;
  const activeDirects = await retry(() => ad.getActiveDirectCount(addr)) as bigint;
  const directs = await retry(() => ad.getDirectReferrals(addr)) as string[];
  const referrer = await retry(() => ad.referrerOf(addr)) as string;
  const allIncome = await retry(() => ad.getAllIncome(addr)) as [bigint, bigint, bigint];

  const block = await retry(() => provider.getBlock("latest")) as { timestamp: number };
  const now = block.timestamp;

  const stakeDetails = [];
  let compoundable = 0;
  for (let i = 0; i < stakes.length; i++) {
    const s = stakes[i];
    const interval = TIER_INTERVALS[Number(s.tier)] || 900;
    const elapsed = now - Number(s.lastCompoundTime);
    const intervalsReady = Math.floor(elapsed / interval);
    const canCompound = s.active && intervalsReady > 0;
    if (canCompound) compoundable++;
    stakeDetails.push({
      id: i, active: s.active, tier: Number(s.tier),
      amount: s.amount, compoundEarned: s.compoundEarned,
      elapsed, intervalsReady, canCompound,
    });
  }

  return {
    addr, activeStake, hasActive, stakes: stakeDetails, compoundable,
    unlockedLevels: Number(unlockedLevels),
    activeDirects: Number(activeDirects),
    totalDirects: directs.length,
    directAddrs: directs.map((d: string) => d.toLowerCase()),
    referrer: referrer.toLowerCase(),
    teamDiv: allIncome[1], directDiv: allIncome[0], rankDiv: allIncome[2],
  };
}

function printUser(u: any, depth: number, label: string = "") {
  const pad = "  " + "│ ".repeat(depth);
  console.log(`${pad}┌─ ${short(u.addr)}${label}  [Depth ${depth}]`);
  console.log(`${pad}│  Referrer:       ${short(u.referrer)}`);
  console.log(`${pad}│  Active Stake:   $${fmt(u.activeStake)} ${u.hasActive ? '✅' : '❌ INACTIVE'}`);
  console.log(`${pad}│  Directs:        ${u.totalDirects} total, ${u.activeDirects} active`);
  console.log(`${pad}│  Unlocked Levels: ${u.unlockedLevels}/15`);
  console.log(`${pad}│  Income:         Direct=$${fmt(u.directDiv)}  Team=$${fmt(u.teamDiv)}  Rank=$${fmt(u.rankDiv)}`);

  for (const s of u.stakes) {
    console.log(`${pad}│  Stake#${s.id}: active=${s.active} tier=${s.tier} amt=$${fmt(s.amount)} compEarned=$${fmt(s.compoundEarned)} elapsed=${s.elapsed}s intervals=${s.intervalsReady} ${s.canCompound ? '⏰ DUE' : ''}`);
  }
  if (u.stakes.length === 0) console.log(`${pad}│  Stakes: NONE`);
  console.log(`${pad}└────────────────────────────────`);
}

async function main() {
  const provider = ethers.provider;
  const [signer] = await ethers.getSigners();
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         TEAM DIVIDEND DEEP DIAGNOSIS                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log(`Signer: ${signer.address}`);

  // ── 1. CONTRACT SETUP ──
  console.log("\n── 1. CONTRACT SETUP ──");
  const genesis = (await retry(() => ad.genesisAccount())).toLowerCase();
  const smAffDist = await retry(() => sm.affiliateDistributor());
  const stakingRole = await retry(() => ad.STAKING_ROLE());
  const smHasRole = await retry(() => ad.hasRole(stakingRole, STAKING_MANAGER));

  console.log(`  Genesis:          ${genesis}`);
  console.log(`  SM↔AD linked:     ${smAffDist.toLowerCase() === AFFILIATE_DISTRIBUTOR.toLowerCase() ? '✅' : '❌ MISMATCH'}`);
  console.log(`  SM has STAKING_ROLE: ${smHasRole ? '✅' : '❌ MISSING'}`);

  if (!smHasRole) {
    console.log("\n  🚨 CRITICAL: StakingManager cannot call distributeTeamDividend! Grant STAKING_ROLE first.");
    return;
  }

  // ── 2. WALK TREE (3 levels deep from genesis) ──
  console.log("\n── 2. REFERRAL TREE (3 levels from genesis) ──\n");

  const genesisInfo = await getUserInfo(sm, ad, genesis, provider);
  printUser(genesisInfo, 0, " (GENESIS)");

  // Collect all users we find
  const allUsers: any[] = [genesisInfo];
  const MAX_DEPTH = 3;

  // BFS with depth limit
  let currentLevel = [genesisInfo];
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const nextLevel: any[] = [];
    for (const parent of currentLevel) {
      for (const childAddr of parent.directAddrs) {
        try {
          await new Promise(r => setTimeout(r, 300)); // rate limit
          const childInfo = await getUserInfo(sm, ad, childAddr, provider);
          printUser(childInfo, depth);
          allUsers.push(childInfo);
          nextLevel.push(childInfo);
        } catch (err: any) {
          console.log(`  ⚠️ Failed to fetch ${short(childAddr)}: ${err.code || err.message?.slice(0, 50)}`);
        }
      }
    }
    currentLevel = nextLevel;
    if (currentLevel.length === 0) break;
  }

  // ── 3. SIMULATE DISTRIBUTION ──
  console.log("\n── 3. SIMULATE distributeTeamDividend ──\n");

  // Find compoundable stakes
  const compoundable = allUsers.filter(u => u.compoundable > 0);
  if (compoundable.length === 0) {
    console.log("  ⚠️ NO stakes are due for compounding — team dividends CANNOT be generated.\n");
  } else {
    // Pick the deepest compoundable user (most uplines to check)
    const testUser = compoundable.sort((a, b) => {
      const depthA = allUsers.indexOf(a);
      const depthB = allUsers.indexOf(b);
      return depthB - depthA;
    })[0];

    console.log(`  Simulating compound for: ${short(testUser.addr)}\n`);

    const userMap = new Map(allUsers.map(u => [u.addr, u]));
    let current = testUser.addr;
    for (let level = 0; level < 15; level++) {
      const uplineData = userMap.get(current);
      if (!uplineData) break;
      const upline = uplineData.referrer;
      if (upline === ethers.ZeroAddress || upline === current) {
        console.log(`    L${level + 1}: ── chain ends ──`);
        break;
      }

      const up = userMap.get(upline);
      const uLevels = up ? up.unlockedLevels : '?';
      const uStake = up ? `$${fmt(up.activeStake)}` : '?';
      const hasActive = up ? up.hasActive : false;
      const pctBp = [1000, 500, 500, 500, 500, 500, 500, 500, 500, 500, 200, 200, 200, 200, 200][level];

      let wouldReceive = false;
      let reason = "";
      if (!up) {
        reason = "(not in scanned tree)";
      } else if (up.unlockedLevels === 0) {
        reason = "0 unlocked levels (needs active directs)";
      } else if (level >= up.unlockedLevels) {
        reason = `level ${level + 1} > unlocked ${up.unlockedLevels}`;
      } else if (!up.hasActive) {
        reason = "no active stake on this upline";
      } else {
        wouldReceive = true;
      }

      console.log(`    L${level + 1}: ${short(upline)} | unlocked=${uLevels} stake=${uStake} | ${pctBp / 100}% | ${wouldReceive ? '✅ WOULD EARN' : '❌ ' + reason}`);
      current = upline;
    }
  }

  // ── 4. LIVE COMPOUND TEST ──
  console.log("\n── 4. LIVE COMPOUND TEST ──\n");

  if (compoundable.length === 0) {
    console.log("  Skipping — no compoundable stakes.\n");
  } else {
    const testUser = compoundable[0];
    const stk = testUser.stakes.find((s: any) => s.canCompound);
    if (!stk) {
      console.log("  Skipping — no due stake found.\n");
    } else {
      console.log(`  Executing: compoundFor(${short(testUser.addr)}, stakeId=${stk.id})\n`);

      // Snapshot upline team dividends BEFORE
      const snapshots: { addr: string; before: bigint }[] = [];
      let cur = testUser.addr;
      for (let i = 0; i < 5; i++) {
        const ref = (await retry(() => ad.referrerOf(cur))).toLowerCase();
        if (ref === ethers.ZeroAddress || ref === cur) break;
        const income = await retry(() => ad.getAllIncome(ref));
        snapshots.push({ addr: ref, before: income[1] });
        cur = ref;
      }

      try {
        const gasEst = await retry(() => sm.compoundFor.estimateGas(testUser.addr, stk.id));
        const tx = await sm.compoundFor(testUser.addr, stk.id, {
          gasLimit: (gasEst * BigInt(150)) / BigInt(100),
        });
        const receipt = await tx.wait();
        console.log(`  ✅ TX mined: ${receipt!.hash} (status=${receipt!.status})\n`);

        // Compare AFTER
        let anyChanged = false;
        for (const s of snapshots) {
          const incomeAfter = await retry(() => ad.getAllIncome(s.addr));
          const after = incomeAfter[1];
          const diff = after - s.before;
          if (diff > 0n) anyChanged = true;
          console.log(`    ${short(s.addr)}: Team $${fmt(s.before)} → $${fmt(after)} (${diff > 0n ? '+' : ''}$${fmt(diff)}) ${diff > 0n ? '💰' : '—'}`);
        }

        if (!anyChanged) {
          console.log("\n  ⚠️ Compound succeeded but NO team dividends distributed.");
          console.log("     Root cause: uplines don't meet conditions (unlocked levels + active stake).");
        } else {
          console.log("\n  ✅ Team dividends ARE working! The issue is that closings weren't triggering compounds.");
        }
      } catch (err: any) {
        console.log(`  ❌ Compound failed: ${err.reason || err.message}`);
      }
    }
  }

  // ── 5. SUMMARY ──
  console.log("\n── 5. DIAGNOSIS SUMMARY ──\n");

  const issues: string[] = [];
  const genesisHasNoStake = !genesisInfo.hasActive;
  if (genesisHasNoStake) {
    issues.push("ℹ️  Genesis (root) has no active stake — by design, genesis can never earn team dividends.");
  }
  if (genesisInfo.activeDirects === 0) {
    issues.push("❌ Genesis has 0 active directs — L1 users either have no active stake or stakes are capped.");
  }

  const l1Users = allUsers.filter(u => u.referrer === genesis);
  for (const l1 of l1Users) {
    if (!l1.hasActive) {
      issues.push(`❌ L1 ${short(l1.addr)} has NO active stake → doesn't count as "active direct" for genesis.`);
    }
    if (l1.activeDirects === 0 && l1.totalDirects > 0) {
      issues.push(`❌ L1 ${short(l1.addr)} has ${l1.totalDirects} directs but 0 active → unlocked levels = 0.`);
    }
  }

  const l2Users = allUsers.filter(u => l1Users.some(l1 => l1.addr === u.referrer));
  for (const l2 of l2Users) {
    if (!l2.hasActive) {
      issues.push(`❌ L2 ${short(l2.addr)} has NO active stake → doesn't unlock levels for its upline.`);
    }
  }

  if (compoundable.length === 0) {
    issues.push("⚠️  No compoundable stakes in scanned tree — team dividends have no profit source.");
  }

  if (issues.length === 0) {
    console.log("  ✅ No issues found. Team dividends should be distributing correctly.");
  } else {
    for (const issue of issues) console.log(`  ${issue}`);
  }

  console.log("\n══════════════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
