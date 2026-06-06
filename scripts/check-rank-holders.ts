import { ethers, formatUnits } from "ethers";
import "dotenv/config";

/**
 * Debug: Check all potential rank holders on mainnet.
 * Finds users with highest team volumes to see if anyone qualifies for rank.
 *
 * Usage: npx ts-node scripts/check-rank-holders.ts
 */

// opBNB Mainnet
const AFFILIATE_DIST = "0x8C7FF618C0Bc7ae9b9fd2828Ba33d977edb99237";
const STAKING_MANAGER = "0x21c22de855e87B2124A50d76f31E79152C977090";
const RPC = process.env.OPBNB_MAINNET_RPC || "https://opbnb-mainnet-rpc.bnbchain.org";
const USDT_DECIMALS = 18;

const AffiliateABI = [
  "function getDirectReferrals(address _user) view returns (address[])",
  "function getTeamVolume(address _user) view returns (uint256)",
  "function getUserRankInfo(address _user) view returns (uint256, uint256, uint256, uint256, uint256)",
  "function referrerOf(address) view returns (address)",
  "function genesisAccount() view returns (address)",
];

const StakingABI = [
  "function getTotalActiveStakeValue(address _user) view returns (uint256)",
];

const RANK_THRESHOLDS = [
  10_000, 30_000, 100_000, 300_000, 1_000_000,
  3_000_000, 10_000_000, 30_000_000, 100_000_000, 250_000_000,
];

const RANK_NAMES = [
  "USER", "Associate", "Executive", "Director", "Vice President",
  "Senior VP", "Managing Director", "Partner", "Senior Partner",
  "Global Leader", "Chairman",
];

function fmtUsd(val: bigint): string {
  return `$${Number(formatUnits(val, USDT_DECIMALS)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(val: bigint): number {
  return Number(formatUnits(val, USDT_DECIMALS));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const affiliate = new ethers.Contract(AFFILIATE_DIST, AffiliateABI, provider);
  const staking = new ethers.Contract(STAKING_MANAGER, StakingABI, provider);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  KAIRO DAO — Rank Holders Check (Mainnet)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  RPC      : ${RPC}`);
  console.log(`  Network  : opBNB Mainnet (204)`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Get genesis account (root of the tree)
  let genesis: string;
  try {
    genesis = await affiliate.genesisAccount();
    console.log(`  Genesis Account: ${genesis}\n`);
  } catch (e: any) {
    console.log(`  Could not get genesis account: ${e.message?.slice(0, 100)}`);
    console.log("  Trying system wallet as root...");
    genesis = "0x5f1DcDaBaa4df191C9faEf933583D6B7721b3268";
  }

  // BFS from genesis to find all users and their team volumes
  console.log("─── BFS: Finding all registered users ────────────────────\n");

  const visited = new Set<string>();
  const userVolumes: Array<{ address: string; teamVolume: number; personalStake: number; directCount: number; onChainRank: number }> = [];
  let queue = [genesis.toLowerCase()];
  visited.add(genesis.toLowerCase());

  while (queue.length > 0) {
    const nextQueue: string[] = [];

    for (const addr of queue) {
      try {
        const [teamVol, stakeVal, rankInfo, directRefs] = await Promise.all([
          affiliate.getTeamVolume(addr).catch(() => 0n),
          staking.getTotalActiveStakeValue(addr).catch(() => 0n),
          affiliate.getUserRankInfo(addr).catch(() => [0n, 0n, 0n, 0n, 0n]),
          affiliate.getDirectReferrals(addr).catch(() => []),
        ]);

        const tv = fmtNum(BigInt(teamVol));
        const ps = fmtNum(BigInt(stakeVal));
        const onChainRank = Number(rankInfo[0]);

        userVolumes.push({
          address: addr,
          teamVolume: tv,
          personalStake: ps,
          directCount: (directRefs as string[]).length,
          onChainRank,
        });

        // Add direct referrals to queue
        for (const ref of (directRefs as string[])) {
          const refLower = ref.toLowerCase();
          if (!visited.has(refLower)) {
            visited.add(refLower);
            nextQueue.push(refLower);
          }
        }
      } catch (e: any) {
        // skip errors
      }
    }

    queue = nextQueue;
    process.stdout.write(`  Found ${visited.size} users so far...\r`);
  }

  console.log(`\n  Total registered users found: ${visited.size}\n`);

  // Sort by team volume descending
  userVolumes.sort((a, b) => b.teamVolume - a.teamVolume);

  // Show top 20 by team volume
  console.log("─── TOP 20 BY TEAM VOLUME ────────────────────────────────\n");
  console.log("  #   | Address                                    | Team Volume    | Personal   | Directs | On-Chain Rank");
  console.log("  ----+--------------------------------------------+----------------+------------+---------+--------------");

  for (let i = 0; i < Math.min(20, userVolumes.length); i++) {
    const u = userVolumes[i];
    const rankName = RANK_NAMES[u.onChainRank] || "?";
    console.log(
      `  ${String(i + 1).padStart(3)} | ${u.address} | $${u.teamVolume.toFixed(2).padStart(12)} | $${u.personalStake.toFixed(2).padStart(8)} | ${String(u.directCount).padStart(7)} | ${rankName} (${u.onChainRank})`
    );
  }

  // Check who qualifies for ranks
  console.log("\n─── RANK QUALIFICATION CHECK ─────────────────────────────\n");
  console.log(`  Rank thresholds: ${RANK_THRESHOLDS.map((t, i) => `Rank ${i + 1}=$${t.toLocaleString()}`).join(', ')}\n`);

  const qualifiers = userVolumes.filter(u => u.teamVolume >= RANK_THRESHOLDS[0]);
  if (qualifiers.length === 0) {
    console.log(`  ❌ NO users qualify for ANY rank (need >= $${RANK_THRESHOLDS[0].toLocaleString()} team volume)`);
    console.log(`  Highest team volume: $${userVolumes[0]?.teamVolume.toFixed(2) || '0'} (${userVolumes[0]?.address || 'N/A'})`);
    const remaining = RANK_THRESHOLDS[0] - (userVolumes[0]?.teamVolume || 0);
    console.log(`  Gap to Rank 1 (Associate): $${remaining.toFixed(2)} more needed`);
  } else {
    console.log(`  ✅ ${qualifiers.length} user(s) qualify for a rank:`);
    for (const q of qualifiers) {
      let maxRank = 0;
      for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
        if (q.teamVolume >= RANK_THRESHOLDS[i]) {
          maxRank = i + 1;
          break;
        }
      }
      console.log(`    ${q.address} → ${RANK_NAMES[maxRank]} (team vol: $${q.teamVolume.toFixed(2)}, on-chain: ${RANK_NAMES[q.onChainRank]})`);
    }
  }

  // Users with on-chain rank > 0
  const onChainRanked = userVolumes.filter(u => u.onChainRank > 0);
  console.log(`\n  Users with on-chain rank > 0: ${onChainRanked.length}`);
  for (const u of onChainRanked) {
    console.log(`    ${u.address} → on-chain rank ${u.onChainRank} (${RANK_NAMES[u.onChainRank]})`);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  CHECK COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
