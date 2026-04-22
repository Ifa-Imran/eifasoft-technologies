import { ethers } from "hardhat";

const STAKING_MANAGER = "0x14E9FAC14336cD1f4A145551CE41DacAab5427F5";
const AFFILIATE_DISTRIBUTOR = "0x07667687121941a491569308c81c7D6dAD295a55";

// Known registered users from indexer logs
const USERS = [
  { label: "Genesis", addr: "0xf8d040de13375eff49dfe5adc02b0ed66b741665" },
  { label: "User2",   addr: "0x6726f92ae08a26a411fadc5b0bb8f0a28b6dd7ca" },
  { label: "User3",   addr: "0x65fb5fb2dcf452507264fbed3f73643f7222270a" },
  { label: "User4",   addr: "0x7349290fd91ae729f96fd1cd8c45df2153ffb56f" },
];

async function main() {
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);

  console.log("=== REFERRAL TREE ===");
  for (const u of USERS) {
    const referrer = await ad.referrerOf(u.addr);
    const directCount = await ad.directCount(u.addr);
    console.log(`${u.label} (${u.addr}):`);
    console.log(`  referrer: ${referrer}`);
    console.log(`  directCount: ${directCount}`);
  }

  console.log("\n=== ACTIVE STAKE STATUS ===");
  for (const u of USERS) {
    const hasActive = await sm.hasActivePosition(u.addr);
    const totalActiveValue = await sm.getTotalActiveStakeValue(u.addr);
    const stakeCount = await sm.getUserStakeCount(u.addr);
    console.log(`${u.label} (${u.addr}):`);
    console.log(`  hasActivePosition: ${hasActive}`);
    console.log(`  totalActiveStakeValue: ${ethers.formatUnits(totalActiveValue, 18)} USDT`);
    console.log(`  stakeCount: ${stakeCount}`);

    // List individual stakes
    for (let i = 0; i < Number(stakeCount); i++) {
      const stake = await sm.userStakes(u.addr, i);
      console.log(`  Stake #${i}: amount=${ethers.formatUnits(stake.amount, 18)}, original=${ethers.formatUnits(stake.originalAmount, 18)}, active=${stake.active}, tier=${stake.tier}, totalEarned=${ethers.formatUnits(stake.totalEarned, 18)}, compoundEarned=${ethers.formatUnits(stake.compoundEarned, 18)}`);
      console.log(`    lastCompoundTime=${new Date(Number(stake.lastCompoundTime) * 1000).toISOString()}`);
    }
  }

  console.log("\n=== TEAM DIVIDEND LEVELS ===");
  for (const u of USERS) {
    const activeDirects = await ad.getActiveDirectCount(u.addr);
    const unlockedLevels = await ad.getUnlockedLevels(u.addr);
    const teamDividends = await ad.teamDividends(u.addr);
    console.log(`${u.label}: activeDirects=${activeDirects}, unlockedLevels=${unlockedLevels}, teamDividends=${ethers.formatUnits(teamDividends, 18)}`);
  }

  console.log("\n=== INCOME SUMMARY ===");
  for (const u of USERS) {
    try {
      const income = await ad.getAllIncome(u.addr);
      console.log(`${u.label}: directBonus=${ethers.formatUnits(income[0], 18)}, teamDividend=${ethers.formatUnits(income[1], 18)}, rankSalary=${ethers.formatUnits(income[2], 18)}`);
    } catch (e: any) {
      console.log(`${u.label}: getAllIncome failed - ${e.message}`);
    }
  }

  // Check recent StakeCreated events
  console.log("\n=== RECENT STAKE EVENTS (last 50K blocks) ===");
  const currentBlock = await ethers.provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 50000);
  const stakeFilter = sm.filters.StakeCreated();
  const events = await sm.queryFilter(stakeFilter, fromBlock, currentBlock);
  console.log(`Found ${events.length} StakeCreated events`);
  for (const ev of events) {
    const args = (ev as any).args;
    console.log(`  Block ${ev.blockNumber}: user=${args.user}, stakeId=${args.stakeId}, amount=${ethers.formatUnits(args.amount, 18)}, tier=${args.tier}`);
  }

  // Check Compounded events
  const compFilter = sm.filters.Compounded();
  const compEvents = await sm.queryFilter(compFilter, fromBlock, currentBlock);
  console.log(`\nFound ${compEvents.length} Compounded events`);
  for (const ev of compEvents.slice(-10)) {
    const args = (ev as any).args;
    console.log(`  Block ${ev.blockNumber}: user=${args.user}, stakeId=${args.stakeId}, profit=${ethers.formatUnits(args.profit, 18)}, newAmount=${ethers.formatUnits(args.newAmount, 18)}`);
  }

  // Check TeamEarned events
  const teamFilter = ad.filters.TeamEarned();
  const teamEvents = await ad.queryFilter(teamFilter, fromBlock, currentBlock);
  console.log(`\nFound ${teamEvents.length} TeamEarned events`);
  for (const ev of teamEvents.slice(-20)) {
    const args = (ev as any).args;
    console.log(`  Block ${ev.blockNumber}: upline=${args.upline}, staker=${args.staker}, level=${args.level}, amount=${ethers.formatUnits(args.amount, 18)}`);
  }
}

main().catch(console.error);
