/**
 * setup-l1-stake.ts — Set up L1 (upline) and L2 (downline) wallets with stakes
 *
 * This script:
 * 1. Sends tBNB gas to both wallets from deployer
 * 2. Registers L1 under deployer (genesis) in AffiliateDistributor
 * 3. Mints USDT to L1, approves StakingManager, creates stake
 * 4. Registers L2 under L1 in AffiliateDistributor
 * 5. Mints USDT to L2, approves StakingManager, creates stake
 *
 * After this:
 *   - When L2's stake compounds, team dividends flow to L1 (since L1 has active stake + 1 unlocked level)
 *   - Run compound-all.ts to trigger compounds manually
 *
 * Usage: npx hardhat run scripts/setup-l1-stake.ts --network opbnbTestnet
 */
import { ethers } from "hardhat";

const STAKING_MANAGER = "0x9d48b6C43fC858767b451De5Efa2ed1089bf3d1a";
const AFFILIATE_DISTRIBUTOR = "0xc1e192AaCd196AE277f45c35Df98674e098CB393";
const USDT_ADDRESS = "0xcFF16786A3d7f372Fa93D72aF9b27c91e884cEA5";

const L1_KEY = "edea0b8af9080af0e04a95a59e68b5236fb9ebd911833bda712ea709a0348a38";
const L2_KEY = "0ae0e3d497e3a4b330b363e9b3a3cacbe7e457ba1114dd68990853b9cd2ffb64";

const L1_STAKE = ethers.parseUnits("200", 18);  // $200 stake for L1
const L2_STAKE = ethers.parseUnits("500", 18);  // $500 stake for L2
const GAS_AMOUNT = ethers.parseEther("0.01");    // 0.01 tBNB for gas

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer (Genesis):", deployer.address);

  const l1Wallet = new ethers.Wallet(L1_KEY, ethers.provider);
  const l2Wallet = new ethers.Wallet(L2_KEY, ethers.provider);
  console.log("L1 (Upline):  ", l1Wallet.address);
  console.log("L2 (Downline): ", l2Wallet.address);

  const usdt = await ethers.getContractAt("MockUSDT", USDT_ADDRESS);
  const sm = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
  const ad = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DISTRIBUTOR);

  // Verify deployer is genesis
  const genesis = await ad.genesisAccount();
  console.log(`\nGenesis: ${genesis}`);
  if (genesis.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Deployer is NOT the genesis account!");
    process.exit(1);
  }

  // ============================================================
  // Step 1: Send gas (tBNB) to both wallets
  // ============================================================
  console.log(`\n=== Step 1: Send gas to wallets ===`);

  const l1BnbBal = await ethers.provider.getBalance(l1Wallet.address);
  if (l1BnbBal < GAS_AMOUNT) {
    console.log(`  Sending ${ethers.formatEther(GAS_AMOUNT)} tBNB to L1...`);
    const tx = await deployer.sendTransaction({ to: l1Wallet.address, value: GAS_AMOUNT });
    await tx.wait();
    console.log("  ✅ Gas sent to L1");
  } else {
    console.log(`  L1 already has ${ethers.formatEther(l1BnbBal)} tBNB — skip`);
  }

  const l2BnbBal = await ethers.provider.getBalance(l2Wallet.address);
  if (l2BnbBal < GAS_AMOUNT) {
    console.log(`  Sending ${ethers.formatEther(GAS_AMOUNT)} tBNB to L2...`);
    const tx = await deployer.sendTransaction({ to: l2Wallet.address, value: GAS_AMOUNT });
    await tx.wait();
    console.log("  ✅ Gas sent to L2");
  } else {
    console.log(`  L2 already has ${ethers.formatEther(l2BnbBal)} tBNB — skip`);
  }

  // ============================================================
  // Step 2: Register L1 under deployer (genesis)
  // ============================================================
  console.log(`\n=== Step 2: Register L1 under Genesis ===`);

  const l1Referrer = await ad.referrerOf(l1Wallet.address);
  if (l1Referrer !== ethers.ZeroAddress) {
    console.log(`  L1 already registered (referrer: ${l1Referrer.slice(0, 10)}...) — skip`);
  } else {
    const adL1 = ad.connect(l1Wallet) as typeof ad;
    const tx = await adL1.register(deployer.address);
    await tx.wait();
    console.log("  ✅ L1 registered under genesis");
  }

  // ============================================================
  // Step 3: Mint USDT to L1, approve, stake
  // ============================================================
  console.log(`\n=== Step 3: L1 Stake ($${ethers.formatUnits(L1_STAKE, 18)}) ===`);

  const l1ActiveStake = await sm.getTotalActiveStakeValue(l1Wallet.address);
  if (l1ActiveStake > 0n) {
    console.log(`  L1 already has active stake: $${ethers.formatUnits(l1ActiveStake, 18)} — skip`);
  } else {
    // Mint USDT
    console.log("  Minting USDT to L1...");
    let tx = await usdt.mint(l1Wallet.address, L1_STAKE);
    await tx.wait();

    // Approve
    console.log("  L1 approving StakingManager...");
    const usdtL1 = usdt.connect(l1Wallet) as typeof usdt;
    tx = await usdtL1.approve(STAKING_MANAGER, L1_STAKE);
    await tx.wait();

    // Stake
    console.log("  L1 staking...");
    const smL1 = sm.connect(l1Wallet) as typeof sm;
    tx = await smL1.stake(L1_STAKE, deployer.address);
    await tx.wait();
    console.log("  ✅ L1 staked successfully");
  }

  // ============================================================
  // Step 4: Register L2 under L1
  // ============================================================
  console.log(`\n=== Step 4: Register L2 under L1 ===`);

  const l2Referrer = await ad.referrerOf(l2Wallet.address);
  if (l2Referrer !== ethers.ZeroAddress) {
    console.log(`  L2 already registered (referrer: ${l2Referrer.slice(0, 10)}...) — skip`);
  } else {
    const adL2 = ad.connect(l2Wallet) as typeof ad;
    const tx = await adL2.register(l1Wallet.address);
    await tx.wait();
    console.log("  ✅ L2 registered under L1");
  }

  // ============================================================
  // Step 5: Mint USDT to L2, approve, stake
  // ============================================================
  console.log(`\n=== Step 5: L2 Stake ($${ethers.formatUnits(L2_STAKE, 18)}) ===`);

  const l2ActiveStake = await sm.getTotalActiveStakeValue(l2Wallet.address);
  if (l2ActiveStake > 0n) {
    console.log(`  L2 already has active stake: $${ethers.formatUnits(l2ActiveStake, 18)} — skip`);
  } else {
    // Mint USDT
    console.log("  Minting USDT to L2...");
    let tx = await usdt.mint(l2Wallet.address, L2_STAKE);
    await tx.wait();

    // Approve
    console.log("  L2 approving StakingManager...");
    const usdtL2 = usdt.connect(l2Wallet) as typeof usdt;
    tx = await usdtL2.approve(STAKING_MANAGER, L2_STAKE);
    await tx.wait();

    // Stake
    console.log("  L2 staking...");
    const smL2 = sm.connect(l2Wallet) as typeof sm;
    tx = await smL2.stake(L2_STAKE, l1Wallet.address);
    await tx.wait();
    console.log("  ✅ L2 staked successfully");
  }

  // ============================================================
  // Final Status
  // ============================================================
  console.log(`\n${"=".repeat(60)}`);
  console.log("SETUP COMPLETE — Final Status");
  console.log("=".repeat(60));

  // L1 status
  const l1Stake = await sm.getTotalActiveStakeValue(l1Wallet.address);
  const l1Unlocked = await ad.getUnlockedLevels(l1Wallet.address);
  const l1ActiveDirects = await ad.getActiveDirectCount(l1Wallet.address);
  const [l1Direct, l1Team, l1Rank] = await ad.getAllIncome(l1Wallet.address);
  console.log(`\n  L1 (${l1Wallet.address}):`);
  console.log(`    Active Stake:   $${ethers.formatUnits(l1Stake, 18)}`);
  console.log(`    Active Directs: ${l1ActiveDirects}`);
  console.log(`    Unlocked Levels: ${l1Unlocked}`);
  console.log(`    Direct Income:  $${ethers.formatUnits(l1Direct, 18)}`);
  console.log(`    Team Income:    $${ethers.formatUnits(l1Team, 18)}`);
  console.log(`    Rank Income:    $${ethers.formatUnits(l1Rank, 18)}`);

  // L2 status
  const l2Stake = await sm.getTotalActiveStakeValue(l2Wallet.address);
  const l2Unlocked = await ad.getUnlockedLevels(l2Wallet.address);
  const [l2Direct, l2Team, l2Rank] = await ad.getAllIncome(l2Wallet.address);
  console.log(`\n  L2 (${l2Wallet.address}):`);
  console.log(`    Active Stake:   $${ethers.formatUnits(l2Stake, 18)}`);
  console.log(`    Unlocked Levels: ${l2Unlocked}`);
  console.log(`    Direct Income:  $${ethers.formatUnits(l2Direct, 18)}`);
  console.log(`    Team Income:    $${ethers.formatUnits(l2Team, 18)}`);
  console.log(`    Rank Income:    $${ethers.formatUnits(l2Rank, 18)}`);

  // Deployer status
  const depUnlocked = await ad.getUnlockedLevels(deployer.address);
  const depActiveDirects = await ad.getActiveDirectCount(deployer.address);
  const [depDirect, depTeam, depRank] = await ad.getAllIncome(deployer.address);
  console.log(`\n  Deployer/Genesis (${deployer.address}):`);
  console.log(`    Active Directs: ${depActiveDirects}`);
  console.log(`    Unlocked Levels: ${depUnlocked}`);
  console.log(`    Direct Income:  $${ethers.formatUnits(depDirect, 18)}`);
  console.log(`    Team Income:    $${ethers.formatUnits(depTeam, 18)}`);
  console.log(`    Rank Income:    $${ethers.formatUnits(depRank, 18)}`);

  console.log(`\n${"=".repeat(60)}`);
  console.log("Referral Tree: Genesis → L1 → L2");
  console.log(`  Genesis (cannot stake) → L1 ($${ethers.formatUnits(l1Stake, 18)} stake) → L2 ($${ethers.formatUnits(l2Stake, 18)} stake)`);
  console.log(`\nWhen L2 compounds, L1 receives team dividends (L1 has active stake + unlocked level 1).`);
  console.log(`\nNext: Wait 5-15 min for compound interval, then run:`);
  console.log(`  npx hardhat run scripts/compound-all.ts --network opbnbTestnet`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
