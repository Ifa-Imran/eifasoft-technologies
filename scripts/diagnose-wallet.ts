import { ethers } from "hardhat";
import "dotenv/config";

const WALLET_PK = "edea0b8af9080af0e04a95a59e68b5236fb9ebd911833bda712ea709a0348a38";

const CONTRACTS = {
  stakingManager: "0x548cd2EE5BbeaeB80a5396a872E36d31eB3bFe7E",
  affiliateDistributor: "0x1f230901951A3fd731156a5E8A28D1925bfBDE39",
  kairoToken: "0xb9bBf81749F4500DC34134746d1B5C90B2Cb1E48",
  liquidityPool: "0xFE51aa6d2AAe29da104765F019de868AeA977F20",
  cms: "0x76D988e21Be5F87fD450E58a7Ca9e581F73d9F32",
  atomicP2p: "0x09689f32bd6486fb00719bE2BBdD411Fcf052983",
  usdt: "0x9A573463F5f8dBcd4a5D32c7d77c850d6C6BEdCA",
};

async function main() {
  const wallet = new ethers.Wallet(WALLET_PK);
  const address = wallet.address;
  console.log("=== WALLET ADDRESS ===");
  console.log(address);
  console.log("");

  const provider = new ethers.JsonRpcProvider("https://opbnb-testnet.publicnode.com");

  // ── StakingManager ──
  const stakingABI = [
    "function getUserStakes(address user) view returns (tuple(uint256 originalAmount, uint256 currentAmount, uint256 totalEarned, uint256 harvestedRewards, uint256 hardCap, uint256 startTime, uint256 lastCompound, uint8 tier, bool active)[])",
    "function getTotalActiveStakeValue(address user) view returns (uint256)",
    "function getGlobalCapProgress() view returns (uint256 totalStaked, uint256 totalPaid, uint256 capLimit)",
    "function getRemainingCap(address user) view returns (uint256)",
    "function hasActivePosition(address user) view returns (bool)",
  ];
  const staking = new ethers.Contract(CONTRACTS.stakingManager, stakingABI, provider);

  // ── AffiliateDistributor ──
  const affABI = [
    "function getDirectReferrals(address user) view returns (address[])",
    "function getAllIncome(address user) view returns (uint256 direct, uint256 team, uint256 rank)",
    "function getUserRankInfo(address user) view returns (uint256 storedRank, uint256 liveRank, uint256 salary, uint256 lastClaimed, uint256 nextClaimTime)",
    "function getTeamVolume(address user) view returns (uint256)",
    "function getUnlockedLevels(address user) view returns (uint256)",
    "function getTotalHarvestable(address user) view returns (uint256)",
    "function teamVolume(address user) view returns (uint256)",
  ];
  const affiliate = new ethers.Contract(CONTRACTS.affiliateDistributor, affABI, provider);

  // ── Queries ──
  console.log("=== STAKING DATA ===");
  try {
    const stakes = await staking.getUserStakes(address);
    console.log(`Total stakes: ${stakes.length}`);
    let activeCount = 0;
    for (let i = 0; i < stakes.length; i++) {
      const s = stakes[i];
      const tierNames = ["Bronze", "Silver", "Gold"];
      console.log(`  Stake #${i}: tier=${tierNames[s.tier]}, original=$${ethers.formatUnits(s.originalAmount, 18)}, earned=$${ethers.formatUnits(s.totalEarned, 18)}, harvested=$${ethers.formatUnits(s.harvestedRewards, 18)}, cap=$${ethers.formatUnits(s.hardCap, 18)}, active=${s.active}`);
      if (s.active) activeCount++;
    }
    console.log(`Active stakes: ${activeCount}`);
  } catch (e: any) { console.log("getUserStakes error:", e.message); }

  try {
    const totalActive = await staking.getTotalActiveStakeValue(address);
    console.log(`getTotalActiveStakeValue: $${ethers.formatUnits(totalActive, 18)}`);
  } catch (e: any) { console.log("getTotalActiveStakeValue error:", e.message); }

  try {
    const hasActive = await staking.hasActivePosition(address);
    console.log(`hasActivePosition: ${hasActive}`);
  } catch (e: any) { console.log("hasActivePosition error:", e.message); }

  try {
    const remaining = await staking.getRemainingCap(address);
    console.log(`getRemainingCap: $${ethers.formatUnits(remaining, 18)}`);
  } catch (e: any) { console.log("getRemainingCap error:", e.message); }

  console.log("");
  console.log("=== AFFILIATE DATA ===");

  try {
    const directs = await affiliate.getDirectReferrals(address);
    console.log(`Direct referrals: ${directs.length}`);
    for (let i = 0; i < directs.length; i++) {
      console.log(`  [${i}] ${directs[i]}`);
    }

    // Check active stakes for each direct referral
    console.log("\n--- Direct Referral Active Stakes ---");
    for (let i = 0; i < directs.length; i++) {
      try {
        const refStakeVal = await staking.getTotalActiveStakeValue(directs[i]);
        const hasActive = await staking.hasActivePosition(directs[i]);
        console.log(`  ${directs[i]}: activeStakeValue=$${ethers.formatUnits(refStakeVal, 18)}, hasActive=${hasActive}`);
      } catch (e: any) { console.log(`  ${directs[i]}: error - ${e.message}`); }
    }
  } catch (e: any) { console.log("getDirectReferrals error:", e.message); }

  try {
    const income = await affiliate.getAllIncome(address);
    console.log(`\ngetAllIncome: direct=$${ethers.formatUnits(income[0], 18)}, team=$${ethers.formatUnits(income[1], 18)}, rank=$${ethers.formatUnits(income[2], 18)}`);
  } catch (e: any) { console.log("getAllIncome error:", e.message); }

  try {
    const rankInfo = await affiliate.getUserRankInfo(address);
    const rankNames = ["None", "Associate", "Senior", "Manager", "Senior Manager", "Director", "Senior Director", "VP", "Senior VP", "President", "Chairman"];
    console.log(`getUserRankInfo: storedRank=${rankNames[Number(rankInfo[0])]}(${rankInfo[0]}), liveRank=${rankNames[Number(rankInfo[1])]}(${rankInfo[1]}), salary=$${ethers.formatUnits(rankInfo[2], 18)}`);
  } catch (e: any) { console.log("getUserRankInfo error:", e.message); }

  try {
    const teamVol = await affiliate.getTeamVolume(address);
    console.log(`getTeamVolume: $${ethers.formatUnits(teamVol, 18)}`);
  } catch (e: any) { console.log("getTeamVolume error:", e.message); }

  try {
    const unlocked = await affiliate.getUnlockedLevels(address);
    console.log(`getUnlockedLevels: ${unlocked}`);
  } catch (e: any) { console.log("getUnlockedLevels error:", e.message); }

  try {
    const harvestable = await affiliate.getTotalHarvestable(address);
    console.log(`getTotalHarvestable: $${ethers.formatUnits(harvestable, 18)}`);
  } catch (e: any) { console.log("getTotalHarvestable error:", e.message); }

  // Check team volume per direct referral leg
  console.log("\n--- Leg Volumes (teamVolume per direct) ---");
  try {
    const directs = await affiliate.getDirectReferrals(address);
    for (let i = 0; i < directs.length; i++) {
      try {
        const legVol = await affiliate.teamVolume(directs[i]);
        console.log(`  ${directs[i]}: $${ethers.formatUnits(legVol, 18)}`);
      } catch (e: any) { console.log(`  ${directs[i]}: error`); }
    }
  } catch (e: any) { console.log("error:", e.message); }

  console.log("\n=== GLOBAL CAP ===");
  try {
    const cap = await staking.getGlobalCapProgress();
    console.log(`totalStaked=$${ethers.formatUnits(cap[0], 18)}, totalPaid=$${ethers.formatUnits(cap[1], 18)}, capLimit=$${ethers.formatUnits(cap[2], 18)}`);
  } catch (e: any) { console.log("getGlobalCapProgress error:", e.message); }
}

main().catch(console.error);
