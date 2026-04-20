import { ethers } from "hardhat";

const CONTRACTS = {
  stakingManager: "0x548cd2EE5BbeaeB80a5396a872E36d31eB3bFe7E",
  affiliateDistributor: "0x1f230901951A3fd731156a5E8A28D1925bfBDE39",
};

const ADDRESS = "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://opbnb-testnet.publicnode.com");

  const stakingABI = [
    "function getUserStakes(address user) view returns (tuple(uint256 originalAmount, uint256 currentAmount, uint256 totalEarned, uint256 harvestedRewards, uint256 hardCap, uint256 startTime, uint256 lastCompound, uint8 tier, bool active)[])",
  ];
  const staking = new ethers.Contract(CONTRACTS.stakingManager, stakingABI, provider);

  // Check raw tier values for stakes
  console.log("\n=== RAW STAKE TIER VALUES ===");
  const stakes = await staking.getUserStakes(ADDRESS);
  for (let i = 0; i < stakes.length; i++) {
    const s = stakes[i];
    console.log(`Stake #${i}: raw tier=${s.tier}, originalAmount=${ethers.formatUnits(s.originalAmount, 18)}, currentAmount=${ethers.formatUnits(s.currentAmount || s.amount || 0, 18)}, active=${s.active}`);
  }

  // Check rank names from contract
  const affABI = [
    "function getUserRankInfo(address user) view returns (uint256 storedRank, uint256 liveRank, uint256 salary, uint256 lastClaimed, uint256 nextClaimTime)",
    "function getDirectReferrals(address user) view returns (address[])",
    "function RANK_THRESHOLDS(uint256) view returns (uint256)",
  ];
  const affiliate = new ethers.Contract(CONTRACTS.affiliateDistributor, affABI, provider);

  console.log("\n=== RANK DATA ===");
  const rankInfo = await affiliate.getUserRankInfo(ADDRESS);
  console.log(`storedRank=${rankInfo[0]}, liveRank=${rankInfo[1]}, salary=${ethers.formatUnits(rankInfo[2], 18)}`);

  // Check contract rank thresholds
  console.log("\n=== CONTRACT RANK THRESHOLDS ===");
  for (let i = 0; i < 10; i++) {
    try {
      const threshold = await affiliate.RANK_THRESHOLDS(i);
      console.log(`Rank ${i+1}: threshold=$${ethers.formatUnits(threshold, 18)}`);
    } catch (e: any) {
      console.log(`Rank ${i+1}: error - ${e.message?.substring(0, 60)}`);
      break;
    }
  }
}

main().catch(console.error);
