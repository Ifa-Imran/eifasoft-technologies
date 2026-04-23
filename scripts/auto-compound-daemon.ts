/**
 * auto-compound-daemon.ts — Lightweight auto-compound loop (no PostgreSQL/Redis needed)
 *
 * Reads stakes directly from the blockchain and compounds any that are due.
 * Runs in a continuous loop, checking every 60 seconds.
 *
 * Usage: npx hardhat run scripts/auto-compound-daemon.ts --network opbnbTestnet
 *
 * Press Ctrl+C to stop.
 */
import { ethers } from "hardhat";

const STAKING_MANAGER = "0x6b7bC911393F50Ae04ed5d84E3d540c4A62b837b";
const AFFILIATE_DISTRIBUTOR = "0xdE4A258AeA1eE5Fe5f8F19E5213Ba406e1B3cA85";

const CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Auto-Compound Daemon started`);
  console.log(`Deployer/Signer: ${deployer.address}`);
  console.log(`Check interval: ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`Press Ctrl+C to stop.\n`);

  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);

  // Collect all users in the referral tree
  async function collectAllUsers(): Promise<string[]> {
    const users: string[] = [];
    const genesis = await ad.genesisAccount();
    users.push(genesis);

    async function traverse(parent: string, depth: number) {
      if (depth > 10) return;
      try {
        const refs = await ad.getDirectReferrals(parent);
        for (const ref of refs) {
          if (!users.includes(ref)) {
            users.push(ref);
            await traverse(ref, depth + 1);
          }
        }
      } catch {}
    }

    await traverse(genesis, 0);
    return users;
  }

  let cycle = 0;

  while (true) {
    cycle++;
    const now = new Date().toLocaleTimeString();
    console.log(`\n--- Cycle #${cycle} at ${now} ---`);

    try {
      const allUsers = await collectAllUsers();
      console.log(`Scanning ${allUsers.length} users...`);

      let compounded = 0;
      let skipped = 0;

      for (const user of allUsers) {
        try {
          const stakes = await sm.getUserStakes(user);
          for (let i = 0; i < stakes.length; i++) {
            const stk = stakes[i];
            if (!stk.active) continue;

            const tier = await sm.tiers(stk.tier);
            const blockTime = Math.floor(Date.now() / 1000);
            const elapsed = blockTime - Number(stk.lastCompoundTime);
            const intervals = Math.floor(elapsed / Number(tier.compoundInterval));

            if (intervals > 0) {
              try {
                const tx = await sm.compoundFor(user, i);
                await tx.wait();
                compounded++;
                console.log(`  ✓ Compounded ${user.slice(0, 10)}... stakeId=${i} (${intervals} intervals, tier=${stk.tier})`);
              } catch (err: any) {
                console.log(`  ✗ Failed ${user.slice(0, 10)}... stakeId=${i}: ${err.message?.slice(0, 60)}`);
              }
            } else {
              skipped++;
            }
          }
        } catch {}
      }

      console.log(`Cycle #${cycle} done: ${compounded} compounded, ${skipped} not yet due`);

      if (compounded > 0) {
        // Show quick income summary for key users
        for (const user of allUsers) {
          const [d, t, r] = await ad.getAllIncome(user);
          if (d > 0n || t > 0n || r > 0n) {
            console.log(`  ${user.slice(0, 10)}... — Direct: $${ethers.formatUnits(d, 18).slice(0, 10)}, Team: $${ethers.formatUnits(t, 18).slice(0, 10)}, Rank: $${ethers.formatUnits(r, 18).slice(0, 10)}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`Cycle #${cycle} error: ${err.message?.slice(0, 100)}`);
    }

    // Wait for next cycle
    console.log(`Next check in ${CHECK_INTERVAL_MS / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
