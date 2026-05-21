import { ethers } from "hardhat";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const WAIT = 5000;

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== KAIRO DeFi Ecosystem Deployment ===");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
    console.log("");

    // Use deployer as system wallet for testnet; override with env var for production
    const systemWallet = process.env.SYSTEM_WALLET || deployer.address;
    console.log("System Wallet:", systemWallet);

    // Development fund wallet (5% of staking USDT)
    const devFundWallet = process.env.DEV_FUND_WALLET || '0x96c01bc3142eFB0379C96ac5157d04cA6ED1d796';
    console.log("Dev Fund Wallet:", devFundWallet);

    // DAO wallets (env var override per slot, otherwise the canonical mainnet defaults below).
    // Distribution per stake (set in StakingManager): DAOs 1-3 receive 1% each, DAOs 4-7 receive 0.5% each.
    const daoWallets = [
        process.env.DAO_WALLET_1 || '0x4465f4e53241c118a19d092d2495984f467a01a9', // 1%
        process.env.DAO_WALLET_2 || '0x3c5bB7A176F2787de0A6Ae73C6Eff4Ff5dD63295', // 1%
        process.env.DAO_WALLET_3 || '0xe3E3Ca6feD0F6Bd26B1E684854F2B7AFB49b2805', // 1%
        process.env.DAO_WALLET_4 || '0x20d8cF481f06459FdFEAfF9219AD7a979eE06c32', // 0.5%
        process.env.DAO_WALLET_5 || '0xBDAb83d8eb19b0454648Db15897796BCFBB2F9B7', // 0.5%
        process.env.DAO_WALLET_6 || '0x12f25959b654F308BC1C5224bC856fCf50529e60', // 0.5%
        process.env.DAO_WALLET_7 || '0x7DdD88D53A0FEBee5035C97461fba609880311A5', // 0.5%
    ];
    console.log("DAO Wallets:", daoWallets);
    console.log("");

    // ============================================================
    // Step 1: USDT Token Address (from environment variable)
    // Production: use real USDT on opBNB mainnet
    // ============================================================
    console.log("Step 1: Resolving USDT token address...");
    const usdtAddress = process.env.USDT_TOKEN_ADDRESS;
    if (!usdtAddress) throw new Error("USDT_TOKEN_ADDRESS env variable required for mainnet deployment");
    console.log("  Using USDT token at:", usdtAddress);
    console.log("");

    // ============================================================
    // Step 2: Deploy KAIROToken
    // Constructor: (address _admin)
    // ============================================================
    console.log("Step 2: Deploying KAIROToken...");
    const KAIROToken = await ethers.getContractFactory("KAIROToken");
    const kairoToken = await KAIROToken.deploy(deployer.address);
    await kairoToken.waitForDeployment();
    const kairoAddress = await kairoToken.getAddress();
    console.log("  KAIROToken deployed at:", kairoAddress);
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 3: Deploy LiquidityPool (Mini-DEX)
    // Constructor: (address _kairoToken, address _usdtToken)
    // Grants DEFAULT_ADMIN_ROLE to msg.sender (deployer)
    // ============================================================
    console.log("Step 3: Deploying LiquidityPool...");
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(kairoAddress, usdtAddress);
    await liquidityPool.waitForDeployment();
    const liquidityPoolAddress = await liquidityPool.getAddress();
    console.log("  LiquidityPool deployed at:", liquidityPoolAddress);
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 4: Configure KAIROToken - set LP and mint initial supply
    // - setLiquidityPool(liquidityPool) — one-time, admin only
    // - mintInitialSupply() — mints 10,000 KAIRO to LiquidityPool (social lock)
    // ============================================================
    console.log("Step 4: Configuring KAIROToken...");
    const txSetLP = await kairoToken.setLiquidityPool(liquidityPoolAddress);
    await txSetLP.wait();
    console.log("  LiquidityPool set to LiquidityPool");

    const txMint = await kairoToken.mintInitialSupply(devFundWallet);
    await txMint.wait();
    console.log("  Initial supply minted: 10,000 KAIRO social-locked in LiquidityPool, 5 KAIRO to dev fund wallet", devFundWallet);
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 5: Deploy AffiliateDistributor
    // Constructor: (address _kairoToken, address _liquidityPool, address _admin, address _systemWallet)
    // ============================================================
    console.log("Step 5: Deploying AffiliateDistributor...");
    const RANK_INTERVAL_PROD = 7 * 24 * 60 * 60; // 7 days for mainnet
    const AffiliateDistributor = await ethers.getContractFactory("AffiliateDistributor");
    const affiliateDistributor = await AffiliateDistributor.deploy(
        kairoAddress,
        liquidityPoolAddress,
        deployer.address,
        systemWallet,
        RANK_INTERVAL_PROD
    );
    await affiliateDistributor.waitForDeployment();
    const affiliateAddress = await affiliateDistributor.getAddress();
    console.log("  AffiliateDistributor deployed at:", affiliateAddress);
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 6: Deploy StakingManager
    // Constructor: (address _kairoToken, address _liquidityPool, address _usdt, address _developmentFundWallet, address[7] _daoWallets, address _admin)
    // ============================================================
    console.log("Step 6: Deploying StakingManager...");
    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(
        kairoAddress,
        liquidityPoolAddress,
        usdtAddress,
        devFundWallet,
        daoWallets,
        deployer.address
    );
    await stakingManager.waitForDeployment();
    const stakingAddress = await stakingManager.getAddress();
    console.log("  StakingManager deployed at:", stakingAddress);

    // Link StakingManager <-> AffiliateDistributor
    const txSetAffiliate = await stakingManager.setAffiliateDistributor(affiliateAddress);
    await txSetAffiliate.wait();
    console.log("  StakingManager -> AffiliateDistributor linked");

    const txSetStaking = await affiliateDistributor.setStakingManager(stakingAddress);
    await txSetStaking.wait();
    console.log("  AffiliateDistributor -> StakingManager linked (STAKING_ROLE granted)");
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 7: Deploy AtomicP2p
    // Constructor: (address _kairoToken, address _usdtToken, address _liquidityPool)
    // Grants DEFAULT_ADMIN_ROLE + ADMIN_ROLE to msg.sender
    //
    // NOTE: CoreMembershipSubscription (CMS) is intentionally NOT deployed on mainnet.
    // CMS-related historical data is migrated from existing snapshots, so the contract
    // is unnecessary in production. Testnet retains CMS for end-to-end QA only.
    // ============================================================
    console.log("Step 7: Deploying AtomicP2p...");
    const AtomicP2p = await ethers.getContractFactory("AtomicP2p");
    const atomicP2p = await AtomicP2p.deploy(kairoAddress, usdtAddress, liquidityPoolAddress);
    await atomicP2p.waitForDeployment();
    const p2pAddress = await atomicP2p.getAddress();
    console.log("  AtomicP2p deployed at:", p2pAddress);
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 8: Grant Roles across all contracts
    // ============================================================
    console.log("Step 8: Granting roles...");

    // --- KAIROToken Roles ---
    const MINTER_ROLE = await kairoToken.MINTER_ROLE();

    // Grant MINTER_ROLE to StakingManager (for mintTo on compound/unstake/harvest)
    let tx = await kairoToken.grantRole(MINTER_ROLE, stakingAddress);
    await tx.wait();
    console.log("  KAIROToken: MINTER_ROLE -> StakingManager");

    // Grant MINTER_ROLE to AffiliateDistributor (for mint on harvest)
    tx = await kairoToken.grantRole(MINTER_ROLE, affiliateAddress);
    await tx.wait();
    console.log("  KAIROToken: MINTER_ROLE -> AffiliateDistributor");

    // --- LiquidityPool Roles ---
    // Grant CORE_ROLE to StakingManager (for receiveStakingFunds, etc.)
    tx = await liquidityPool.grantCoreRole(stakingAddress);
    await tx.wait();
    console.log("  LiquidityPool: CORE_ROLE -> StakingManager");

    // Grant P2P_ROLE to AtomicP2p (for receiveP2PFee)
    tx = await liquidityPool.grantP2PRole(p2pAddress);
    await tx.wait();
    console.log("  LiquidityPool: P2P_ROLE -> AtomicP2p");

    // Link StakingManager to LiquidityPool & AtomicP2p (for global auto-compound on DEX/P2P)
    tx = await liquidityPool.setStakingManager(stakingAddress);
    await tx.wait();
    console.log("  LiquidityPool -> StakingManager linked (auto-compound on swap)");

    tx = await atomicP2p.setStakingManager(stakingAddress);
    await tx.wait();
    console.log("  AtomicP2p -> StakingManager linked (auto-compound on P2P)");

    console.log("");

    // ============================================================
    // Step 9: Seed LiquidityPool with initial USDT liquidity (OPTIONAL)
    // Transfer initial USDT to LiquidityPool so price oracle works correctly
    // Skip if deployer has no USDT yet — can be funded later
    // ============================================================
    console.log("Step 9: Checking LiquidityPool USDT seeding...");
    const usdt = await ethers.getContractAt("IERC20", usdtAddress);
    const deployerUSDT = await usdt.balanceOf(deployer.address);
    if (deployerUSDT > 0n) {
        const INITIAL_LIQUIDITY = deployerUSDT < ethers.parseEther("10000")
            ? deployerUSDT
            : ethers.parseEther("10000");
        tx = await usdt.transfer(liquidityPoolAddress, INITIAL_LIQUIDITY);
        await tx.wait();
        console.log("  Transferred", ethers.formatEther(INITIAL_LIQUIDITY), "USDT to LiquidityPool");
        const initialPrice = await liquidityPool.getLivePrice();
        console.log("  Initial KAIRO price:", ethers.formatEther(initialPrice), "USDT");
    } else {
        console.log("  SKIPPED: Deployer has 0 USDT. Fund LiquidityPool manually later.");
    }
    console.log("");

    // ============================================================
    // Step 10: Admin roles are KEPT for now.
    // Run scripts/renounce-admin.ts separately after:
    //   1. Verifying all functions work correctly
    //   2. Seeding affiliate tree (seed-affiliate-tree.ts)
    //   3. Migrating stakes (seed-stakes-corrected.ts)
    //   4. Seeding team volumes (seed-team-volumes.ts)
    //   5. Calling finalizeMigration() on StakingManager
    //   6. Final verification of all on-chain state
    // ============================================================
    console.log("Step 10: Admin roles RETAINED for post-deploy verification.");
    console.log("  Run 'npx hardhat run scripts/renounce-admin.ts --network opbnb' after all");
    console.log("  migrations and verifications are complete.");
    console.log("");

    // ============================================================
    // Summary: Print all deployed contract addresses
    // ============================================================
    console.log("=========================================");
    console.log("=== DEPLOYMENT COMPLETE ===");
    console.log("=========================================");
    console.log("");
    console.log("Contract Addresses:");
    console.log("  USDT:                        ", usdtAddress);
    console.log("  KAIROToken:                  ", kairoAddress);
    console.log("  LiquidityPool:               ", liquidityPoolAddress);
    console.log("  AffiliateDistributor:        ", affiliateAddress);
    console.log("  StakingManager:              ", stakingAddress);
    console.log("  AtomicP2p:                   ", p2pAddress);
    console.log("");
    console.log("Configuration:");
    console.log("  System Wallet:               ", systemWallet);
    console.log("  Deployer (ADMIN RETAINED):   ", deployer.address);
    console.log("  Social Lock:                  10,000 KAIRO (locked in LiquidityPool)");
    console.log("  Dev Genesis Mint:             5 KAIRO ->", devFundWallet);
    console.log("  Initial USDT Liquidity:       10,000 USDT");
    console.log("");
    console.log("Active Roles:");
    console.log("  KAIROToken MINTER_ROLE:       StakingManager, AffiliateDistributor");
    console.log("  AffiliateDistributor STAKING_ROLE: StakingManager");
    console.log("  LiquidityPool CORE_ROLE:      StakingManager");
    console.log("  LiquidityPool P2P_ROLE:       AtomicP2p");
    console.log("");
    console.log("  DEPLOYER ADMIN ROLES: RETAINED — run renounce-admin.ts after verification");
    console.log("=========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
