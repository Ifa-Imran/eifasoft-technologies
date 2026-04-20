/**
 * compound-all.ts — Compound all due stakes on-chain (testnet utility)
 *
 * This script:
 * 1. Reads all user stakes from StakingManager
 * 2. Compounds any that have elapsed intervals
 * 3. Shows team dividend balances for the deployer (upline)
 *
 * Usage: npx hardhat run scripts/compound-all.ts --network opbnbTestnet
 */
import { ethers } from "hardhat";

const STAKING_MANAGER = "0x90bce7aCB3429BEF9cE52E9594A90DE69DAad191";
const AFFILIATE_DISTRIBUTOR = "0x27CAc5ffcaDCdB2f7DafaE58Dfd1dEb1C51087CB";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);

  // Get deployer's direct referrals
  const directs = await ad.getDirectReferrals(deployer.address);
  console.log(`\nDirect referrals: ${directs.length}`);

  // Show deployer's current income balances
  const [direct, team, rank] = await ad.getAllIncome(deployer.address);
  console.log(`\n--- Deployer Income Balances ---`);
  console.log(`  Direct: $${ethers.formatUnits(direct, 18)}`);
  console.log(`  Team:   $${ethers.formatUnits(team, 18)}`);
  console.log(`  Rank:   $${ethers.formatUnits(rank, 18)}`);

  const unlockedLevels = await ad.getUnlockedLevels(deployer.address);
  console.log(`  Unlocked Levels: ${unlockedLevels}`);

  const deployerStakeVal = await sm.getTotalActiveStakeValue(deployer.address);
  console.log(`  Deployer Active Stake: $${ethers.formatUnits(deployerStakeVal, 18)}`);

  // For each direct referral, check and compound their stakes
  let totalCompounded = 0;
  const allUsers = [deployer.address, ...directs];

  // Recursively get ALL referrals up to 5 levels deep
  async function collectReferrals(parent: string, depth: number) {
    if (depth > 5) return;
    try {
      const refs = await ad.getDirectReferrals(parent);
      for (const ref of refs) {
        if (!allUsers.includes(ref)) {
          allUsers.push(ref);
          await collectReferrals(ref, depth + 1);
        }
      }
    } catch {}
  }
  for (const directRef of directs) {
    await collectReferrals(directRef, 1);
  }

  console.log(`\n--- Compounding stakes for ${allUsers.length} users ---`);

  for (const user of allUsers) {
    try {
      const stakes = await sm.getUserStakes(user);
      for (let i = 0; i < stakes.length; i++) {
        const stk = stakes[i];
        if (!stk.active) continue;

        // Check if compound is due
        const tier = await sm.tiers(stk.tier);
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - Number(stk.lastCompoundTime);
        const intervals = Math.floor(elapsed / Number(tier.compoundInterval));

        if (intervals > 0) {
          console.log(`  Compounding user=${user.slice(0, 8)}... stakeId=${i} (${intervals} intervals due, tier=${stk.tier})`);
          try {
            const tx = await sm.compoundFor(user, i);
            await tx.wait();
            totalCompounded++;
            console.log(`    ✓ Compounded successfully`);
          } catch (err: any) {
            console.log(`    ✗ Failed: ${err.message?.slice(0, 80)}`);
          }
        } else {
          const remaining = Number(tier.compoundInterval) - elapsed;
          console.log(`  user=${user.slice(0, 8)}... stakeId=${i} — ${remaining}s until next compound`);
        }
      }
    } catch (err: any) {
      console.log(`  Skip user ${user.slice(0, 8)}...: ${err.message?.slice(0, 60)}`);
    }
  }

  console.log(`\nTotal compounded: ${totalCompounded}`);

  // Show updated income balances
  const [direct2, team2, rank2] = await ad.getAllIncome(deployer.address);
  console.log(`\n--- Updated Deployer Income Balances ---`);
  console.log(`  Direct: $${ethers.formatUnits(direct2, 18)}`);
  console.log(`  Team:   $${ethers.formatUnits(team2, 18)} ${team2 > team ? "(INCREASED!)" : ""}`);
  console.log(`  Rank:   $${ethers.formatUnits(rank2, 18)}`);

  // Show income for ALL users in the tree
  console.log(`\n--- All User Incomes ---`);
  for (const user of allUsers) {
    const [d, t, r] = await ad.getAllIncome(user);
    const stakeVal = await sm.getTotalActiveStakeValue(user);
    const unlocked = await ad.getUnlockedLevels(user);
    console.log(`\n  ${user}:`);
    console.log(`    Active Stake: $${ethers.formatUnits(stakeVal, 18)}, Unlocked Levels: ${unlocked}`);
    console.log(`    Direct: $${ethers.formatUnits(d, 18)}, Team: $${ethers.formatUnits(t, 18)}, Rank: $${ethers.formatUnits(r, 18)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
