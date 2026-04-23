import { ethers } from "hardhat";

// Helper: wait for tx with a delay to let RPC nonce sync
const DELAY = 3000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function waitTx(tx: any) {
    const receipt = await tx.wait();
    await sleep(DELAY);
    return receipt;
}

/**
 * KAIRO DeFi Ecosystem - Testnet Deployment Script
 * 
 * Deploys all contracts with MockUSDT, seeds liquidity,
 * and runs optional test transactions to verify the setup.
 * 
 * Usage: npx hardhat run scripts/deploy-testnet.ts --network opbnbTestnet
 *    or: npx hardhat run scripts/deploy-testnet.ts --network hardhat
 */
async function main() {
    const [deployer, testUser] = await ethers.getSigners();
    console.log("=== KAIRO DeFi Ecosystem - TESTNET Deployment ===");
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
    console.log("");

    const systemWallet = process.env.SYSTEM_WALLET || deployer.address;

    // DAO wallets (1% each for first 4, 0.5% each for last 2 — totaling 5%)
    const daoWallets = [
        '0x4465f4e53241c118a19d092d2495984f467a01a9',
        '0x3c5bB7A176F2787de0A6Ae73C6Eff4Ff5dD63295',
        '0xA91970AcA653591fd20231ad29ecCA0c7F691ceB',
        '0xe3E3Ca6feD0F6Bd26B1E684854F2B7AFB49b2805',
        '0x20d8cF481f06459FdFEAfF9219AD7a979eE06c32',
        '0xBDAb83d8eb19b0454648Db15897796BCFBB2F9B7',
    ];

    // Development fund wallet (receives 5% of staking rewards)
    const developmentFundWallet = '0x1bdbE7e3411E6439741335f1FC9fa37Adf385E07';

    // ============================================================
    // PHASE 1: Deploy all contracts
    // ============================================================
    console.log("--- PHASE 1: Contract Deployment ---");
    console.log("");

    // 1. MockUSDT - constructor() mints 1M to deployer
    console.log("[1/8] Deploying MockUSDT...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    await sleep(DELAY);
    const usdtAddress = await mockUSDT.getAddress();
    console.log("  MockUSDT:", usdtAddress);

    // 2. KAIROToken - constructor(address _admin)
    console.log("[2/8] Deploying KAIROToken...");
    const KAIROToken = await ethers.getContractFactory("KAIROToken");
    const kairoToken = await KAIROToken.deploy(deployer.address);
    await kairoToken.waitForDeployment();
    await sleep(DELAY);
    const kairoAddress = await kairoToken.getAddress();
    console.log("  KAIROToken:", kairoAddress);

    // 3. LiquidityPool - constructor(address _kairoToken, address _usdtToken)
    console.log("[3/8] Deploying LiquidityPool...");
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(kairoAddress, usdtAddress);
    await liquidityPool.waitForDeployment();
    await sleep(DELAY);
    const liquidityPoolAddress = await liquidityPool.getAddress();
    console.log("  LiquidityPool:", liquidityPoolAddress);

    // 4. Configure KAIROToken
    console.log("[4/8] Configuring KAIROToken...");
    let tx = await kairoToken.setLiquidityPool(liquidityPoolAddress);
    await waitTx(tx);
    console.log("  LiquidityPool -> LiquidityPool");
    tx = await kairoToken.mintInitialSupply();
    await waitTx(tx);
    console.log("  Social lock: 10,000 KAIRO minted to LiquidityPool");

    // 5. AffiliateDistributor - constructor(address _kairoToken, address _liquidityPool, address _admin, address _systemWallet)
    console.log("[5/8] Deploying AffiliateDistributor...");
    const AffiliateDistributor = await ethers.getContractFactory("AffiliateDistributor");
    const affiliateDistributor = await AffiliateDistributor.deploy(
        kairoAddress, liquidityPoolAddress, deployer.address, systemWallet
    );
    await affiliateDistributor.waitForDeployment();
    await sleep(DELAY);
    const affiliateAddress = await affiliateDistributor.getAddress();
    console.log("  AffiliateDistributor:", affiliateAddress);

    // 6. StakingManager - constructor(address _kairoToken, address _liquidityPool, address _usdt, address _developmentFundWallet, address[6] _daoWallets, address _admin)
    console.log("[6/8] Deploying StakingManager...");
    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(
        kairoAddress, liquidityPoolAddress, usdtAddress, developmentFundWallet, daoWallets, deployer.address
    );
    await stakingManager.waitForDeployment();
    await sleep(DELAY);
    const stakingAddress = await stakingManager.getAddress();
    console.log("  StakingManager:", stakingAddress);

    // Link StakingManager <-> AffiliateDistributor
    tx = await stakingManager.setAffiliateDistributor(affiliateAddress);
    await waitTx(tx);
    tx = await affiliateDistributor.setStakingManager(stakingAddress);
    await waitTx(tx);
    console.log("  StakingManager <-> AffiliateDistributor linked");

    // 7. CoreMembershipSubscription
    console.log("[7/8] Deploying CoreMembershipSubscription...");
    const CMS = await ethers.getContractFactory("CoreMembershipSubscription");

    // Testing deadlines: 3 hours to subscribe, 6 hours to claim from current block
    const latestBlock = await ethers.provider.getBlock("latest");
    const now = latestBlock!.timestamp;
    const SUBSCRIBE_DEADLINE = now + 3 * 60 * 60;  // +3 hours
    const CLAIM_DEADLINE = now + 6 * 60 * 60;      // +6 hours
    console.log("  Subscribe deadline:", new Date(SUBSCRIBE_DEADLINE * 1000).toUTCString());
    console.log("  Claim deadline:", new Date(CLAIM_DEADLINE * 1000).toUTCString());

    const cms = await CMS.deploy(
        kairoAddress, usdtAddress, liquidityPoolAddress,
        stakingAddress, affiliateAddress, systemWallet, deployer.address,
        SUBSCRIBE_DEADLINE, CLAIM_DEADLINE
    );
    await cms.waitForDeployment();
    await sleep(DELAY);
    const cmsAddress = await cms.getAddress();
    console.log("  CoreMembershipSubscription:", cmsAddress);

    // Link StakingManager -> CMS (for addEarnings authorization)
    tx = await stakingManager.setCMS(cmsAddress);
    await waitTx(tx);
    console.log("  StakingManager -> CMS linked");

    // 8. AtomicP2p - constructor(address _kairoToken, address _usdtToken, address _liquidityPool)
    console.log("[8/8] Deploying AtomicP2p...");
    const AtomicP2p = await ethers.getContractFactory("AtomicP2p");
    const atomicP2p = await AtomicP2p.deploy(kairoAddress, usdtAddress, liquidityPoolAddress);
    await atomicP2p.waitForDeployment();
    await sleep(DELAY);
    const p2pAddress = await atomicP2p.getAddress();
    console.log("  AtomicP2p:", p2pAddress);
    console.log("");

    // ============================================================
    // PHASE 2: Grant all roles
    // ============================================================
    console.log("--- PHASE 2: Role Configuration ---");
    console.log("");

    // KAIROToken roles
    const MINTER_ROLE = await kairoToken.MINTER_ROLE();

    tx = await kairoToken.grantRole(MINTER_ROLE, stakingAddress);
    await waitTx(tx);
    console.log("  KAIROToken MINTER_ROLE -> StakingManager");

    tx = await kairoToken.grantRole(MINTER_ROLE, affiliateAddress);
    await waitTx(tx);
    console.log("  KAIROToken MINTER_ROLE -> AffiliateDistributor");

    tx = await kairoToken.grantRole(MINTER_ROLE, cmsAddress);
    await waitTx(tx);
    console.log("  KAIROToken MINTER_ROLE -> CMS");

    // AffiliateDistributor roles
    const STAKING_ROLE = await affiliateDistributor.STAKING_ROLE();
    tx = await affiliateDistributor.grantRole(STAKING_ROLE, cmsAddress);
    await waitTx(tx);
    console.log("  AffiliateDistributor STAKING_ROLE -> CMS");

    // LiquidityPool roles
    tx = await liquidityPool.grantCoreRole(stakingAddress);
    await waitTx(tx);
    console.log("  LiquidityPool CORE_ROLE -> StakingManager");

    tx = await liquidityPool.grantCoreRole(cmsAddress);
    await waitTx(tx);
    console.log("  LiquidityPool CORE_ROLE -> CMS");

    tx = await liquidityPool.grantP2PRole(p2pAddress);
    await waitTx(tx);
    console.log("  LiquidityPool P2P_ROLE -> AtomicP2p");

    // Link StakingManager to LiquidityPool & AtomicP2p (for global auto-compound on DEX/P2P)
    tx = await liquidityPool.setStakingManager(stakingAddress);
    await waitTx(tx);
    console.log("  LiquidityPool -> StakingManager linked (auto-compound on swap)");

    tx = await atomicP2p.setStakingManager(stakingAddress);
    await waitTx(tx);
    console.log("  AtomicP2p -> StakingManager linked (auto-compound on P2P)");
    console.log("");

    // ============================================================
    // PHASE 3: Seed testnet environment
    // ============================================================
    console.log("--- PHASE 3: Seed Testnet Environment ---");
    console.log("");

    // Register genesis account (deployer as genesis - root of referral tree)
    tx = await affiliateDistributor.grantRole(STAKING_ROLE, deployer.address);
    await waitTx(tx);
    tx = await affiliateDistributor.setReferrer(deployer.address, ethers.ZeroAddress);
    await waitTx(tx);
    console.log("  Genesis account registered:", deployer.address);

    // Mint extra USDT to deployer for testing (constructor minted 1M, add 9M more = 10M total)
    tx = await mockUSDT.mint(deployer.address, ethers.parseEther("9000000"));
    await waitTx(tx);
    console.log("  Minted 9,000,000 extra USDT to deployer (10M total)");

    // Seed LiquidityPool with 10,000 USDT initial liquidity
    const INITIAL_LIQUIDITY = ethers.parseEther("10000");
    tx = await mockUSDT.transfer(liquidityPoolAddress, INITIAL_LIQUIDITY);
    await waitTx(tx);
    console.log("  Transferred 10,000 USDT to LiquidityPool for liquidity");

    const initialPrice = await liquidityPool.getLivePrice();
    console.log("  Initial KAIRO price:", ethers.formatEther(initialPrice), "USDT");

    // If testUser signer exists (hardhat network has multiple), set up a test user
    if (testUser) {
        console.log("");
        console.log("  Test user:", testUser.address);

        // Mint USDT to test user
        tx = await mockUSDT.mint(testUser.address, ethers.parseEther("50000"));
        await waitTx(tx);
        console.log("  Minted 50,000 USDT to test user");
    }
    console.log("");

    // ============================================================
    // PHASE 4: Optional test transactions (hardhat network only)
    // ============================================================
    const network = await ethers.provider.getNetwork();
    if (network.chainId === 31337n && testUser) {
        console.log("--- PHASE 4: Test Transactions (local hardhat) ---");
        console.log("");

        try {
            // Test: User approves and stakes 100 USDT (with deployer/genesis as referrer)
            const stakeAmount = ethers.parseEther("100");
            tx = await mockUSDT.connect(testUser).approve(stakingAddress, stakeAmount);
            await tx.wait();
            tx = await stakingManager.connect(testUser).stake(stakeAmount, deployer.address);
            await tx.wait();
            console.log("  [TEST] Test user staked 100 USDT (Tier 0)");

            // Verify stake
            const stakes = await stakingManager.getUserStakes(testUser.address);
            console.log("  [TEST] Stake active:", stakes[0].active, "| Amount:", ethers.formatEther(stakes[0].amount), "USDT");

            // Test: CMS subscription
            const subCost = ethers.parseEther("10"); // 10 USDT per sub
            tx = await mockUSDT.connect(testUser).approve(liquidityPoolAddress, subCost);
            await tx.wait();
            tx = await cms.connect(testUser).subscribe(1, ethers.ZeroAddress);
            await tx.wait();
            console.log("  [TEST] Test user purchased 1 CMS subscription");

            const subCount = await cms.getSubscriptionCount(testUser.address);
            console.log("  [TEST] Subscription count:", subCount.toString());

            // Check updated price after liquidity changes
            const updatedPrice = await liquidityPool.getLivePrice();
            console.log("  [TEST] Updated KAIRO price:", ethers.formatEther(updatedPrice), "USDT");

        } catch (error: any) {
            console.log("  [TEST] Some test transactions failed (non-critical):", error.message?.substring(0, 100));
        }
        console.log("");
    }

    // ============================================================
    // PHASE 5: Burn ALL deployer admin roles
    // ============================================================
    console.log("--- PHASE 5: Burn ALL Deployer Admin Roles ---");
    console.log("  WARNING: This is irreversible. Deployer will lose all admin control.");
    console.log("");

    const DEFAULT_ADMIN_ROLE = await kairoToken.DEFAULT_ADMIN_ROLE();

    // 1. KAIROToken — renounce DEFAULT_ADMIN_ROLE
    tx = await kairoToken.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await waitTx(tx);
    console.log("  [BURNED] KAIROToken DEFAULT_ADMIN_ROLE");

    // 2. StakingManager — renounce DEFAULT_ADMIN_ROLE
    tx = await stakingManager.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await waitTx(tx);
    console.log("  [BURNED] StakingManager DEFAULT_ADMIN_ROLE");

    // 3. AffiliateDistributor — renounce STAKING_ROLE (genesis setup) + DEFAULT_ADMIN_ROLE
    tx = await affiliateDistributor.renounceRole(STAKING_ROLE, deployer.address);
    await waitTx(tx);
    console.log("  [BURNED] AffiliateDistributor STAKING_ROLE");
    tx = await affiliateDistributor.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await waitTx(tx);
    console.log("  [BURNED] AffiliateDistributor DEFAULT_ADMIN_ROLE");

    // 4. CoreMembershipSubscription — renounce DEFAULT_ADMIN_ROLE
    tx = await cms.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await waitTx(tx);
    console.log("  [BURNED] CMS DEFAULT_ADMIN_ROLE");

    // 5. LiquidityPool — renounce DEFAULT_ADMIN_ROLE
    tx = await liquidityPool.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await waitTx(tx);
    console.log("  [BURNED] LiquidityPool DEFAULT_ADMIN_ROLE");

    // 6. AtomicP2p — renounce ADMIN_ROLE + DEFAULT_ADMIN_ROLE
    const P2P_ADMIN_ROLE = await atomicP2p.ADMIN_ROLE();
    tx = await atomicP2p.renounceRole(P2P_ADMIN_ROLE, deployer.address);
    await waitTx(tx);
    console.log("  [BURNED] AtomicP2p ADMIN_ROLE");
    tx = await atomicP2p.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await waitTx(tx);
    console.log("  [BURNED] AtomicP2p DEFAULT_ADMIN_ROLE");

    console.log("");
    console.log("  ALL DEPLOYER ADMIN ROLES BURNED.");
    console.log("");

    // ============================================================
    // Final Summary
    // ============================================================
    console.log("=============================================");
    console.log("=== TESTNET DEPLOYMENT COMPLETE ===");
    console.log("=============================================");
    console.log("");
    console.log("Contract Addresses (copy for .env / frontend config):");
    console.log(`  MOCK_USDT_ADDRESS=${usdtAddress}`);
    console.log(`  KAIRO_TOKEN_ADDRESS=${kairoAddress}`);
    console.log(`  LIQUIDITY_POOL_ADDRESS=${liquidityPoolAddress}`);
    console.log(`  AFFILIATE_DISTRIBUTOR_ADDRESS=${affiliateAddress}`);
    console.log(`  STAKING_MANAGER_ADDRESS=${stakingAddress}`);
    console.log(`  CMS_ADDRESS=${cmsAddress}`);
    console.log(`  ATOMIC_P2P_ADDRESS=${p2pAddress}`);
    console.log(`  SYSTEM_WALLET=${systemWallet}`);
    console.log(`  DEVELOPMENT_FUND_WALLET=${developmentFundWallet}`);
    console.log(`  DAO_WALLETS=${daoWallets.join(', ')}`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Copy addresses above into your .env file");
    console.log("  2. Verify contracts on explorer (npx hardhat verify)");
    console.log("  3. All on-chain operations (compound, rank sync) are user-initiated");
    console.log("  4. Fund system wallet with gas for operations");
    console.log("=============================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Testnet deployment failed:", error);
        process.exit(1);
    });
