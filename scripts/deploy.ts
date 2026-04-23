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

    // DAO wallets: use env vars for production, deployer address as fallback for testnet
    const daoWallets = [
        process.env.DAO_WALLET_1 || deployer.address,
        process.env.DAO_WALLET_2 || deployer.address,
        process.env.DAO_WALLET_3 || deployer.address,
        process.env.DAO_WALLET_4 || deployer.address,
        process.env.DAO_WALLET_5 || deployer.address,
        process.env.DAO_WALLET_6 || deployer.address,
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

    const txMint = await kairoToken.mintInitialSupply();
    await txMint.wait();
    console.log("  Initial supply minted (10,000 KAIRO social lock to LiquidityPool)");
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 5: Deploy AffiliateDistributor
    // Constructor: (address _kairoToken, address _liquidityPool, address _admin, address _systemWallet)
    // ============================================================
    console.log("Step 5: Deploying AffiliateDistributor...");
    const AffiliateDistributor = await ethers.getContractFactory("AffiliateDistributor");
    const affiliateDistributor = await AffiliateDistributor.deploy(
        kairoAddress,
        liquidityPoolAddress,
        deployer.address,
        systemWallet
    );
    await affiliateDistributor.waitForDeployment();
    const affiliateAddress = await affiliateDistributor.getAddress();
    console.log("  AffiliateDistributor deployed at:", affiliateAddress);
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 6: Deploy StakingManager
    // Constructor: (address _kairoToken, address _liquidityPool, address _usdt, address _developmentFundWallet, address[6] _daoWallets, address _admin)
    // ============================================================
    console.log("Step 6: Deploying StakingManager...");
    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(
        kairoAddress,
        liquidityPoolAddress,
        usdtAddress,
        systemWallet,
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
    // Step 7: Deploy CoreMembershipSubscription (CMS)
    // Constructor: (address _kairoToken, address _usdt, address _liquidityPool,
    //               address _stakingManager, address _affiliateDistributor,
    //               address _systemWallet, address _admin,
    //               uint256 _subscribeDeadline, uint256 _claimDeadline)
    // Production: May 6, 2026 00:00 UTC / June 1, 2026 00:00 UTC
    // ============================================================
    console.log("Step 7: Deploying CoreMembershipSubscription...");
    const CMS = await ethers.getContractFactory("CoreMembershipSubscription");

    // Production deadlines (fixed calendar dates, UTC midnight)
    const SUBSCRIBE_DEADLINE = Math.floor(new Date("2026-05-16T00:00:00Z").getTime() / 1000);
    const CLAIM_DEADLINE = Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000);
    console.log("  Subscribe deadline:", new Date(SUBSCRIBE_DEADLINE * 1000).toUTCString());
    console.log("  Claim deadline:", new Date(CLAIM_DEADLINE * 1000).toUTCString());

    const cms = await CMS.deploy(
        kairoAddress,
        usdtAddress,
        liquidityPoolAddress,
        stakingAddress,
        affiliateAddress,
        systemWallet,
        deployer.address,
        SUBSCRIBE_DEADLINE,
        CLAIM_DEADLINE
    );
    await cms.waitForDeployment();
    const cmsAddress = await cms.getAddress();
    console.log("  CoreMembershipSubscription deployed at:", cmsAddress);
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 8: Deploy AtomicP2p
    // Constructor: (address _kairoToken, address _usdtToken, address _liquidityPool)
    // Grants DEFAULT_ADMIN_ROLE + ADMIN_ROLE to msg.sender
    // ============================================================
    console.log("Step 8: Deploying AtomicP2p...");
    const AtomicP2p = await ethers.getContractFactory("AtomicP2p");
    const atomicP2p = await AtomicP2p.deploy(kairoAddress, usdtAddress, liquidityPoolAddress);
    await atomicP2p.waitForDeployment();
    const p2pAddress = await atomicP2p.getAddress();
    console.log("  AtomicP2p deployed at:", p2pAddress);
    await delay(WAIT);
    console.log("");

    // ============================================================
    // Step 9: Grant Roles across all contracts
    // ============================================================
    console.log("Step 9: Granting roles...");

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

    // Grant MINTER_ROLE to CMS (for mint on claimCMSRewards)
    tx = await kairoToken.grantRole(MINTER_ROLE, cmsAddress);
    await tx.wait();
    console.log("  KAIROToken: MINTER_ROLE -> CoreMembershipSubscription");

    // --- StakingManager: Set CMS contract ---
    tx = await stakingManager.setCMS(cmsAddress);
    await tx.wait();
    console.log("  StakingManager: CMS contract set ->", cmsAddress);

    // --- LiquidityPool Roles ---
    // Grant CORE_ROLE to StakingManager (for receiveStakingFunds, etc.)
    tx = await liquidityPool.grantCoreRole(stakingAddress);
    await tx.wait();
    console.log("  LiquidityPool: CORE_ROLE -> StakingManager");

    // Grant CORE_ROLE to CMS (for withdrawUSDT, receiveForfeitedTierBonus, etc.)
    tx = await liquidityPool.grantCoreRole(cmsAddress);
    await tx.wait();
    console.log("  LiquidityPool: CORE_ROLE -> CoreMembershipSubscription");

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
    // Step 10: Seed LiquidityPool with initial USDT liquidity (OPTIONAL)
    // Transfer initial USDT to LiquidityPool so price oracle works correctly
    // Skip if deployer has no USDT yet — can be funded later
    // ============================================================
    console.log("Step 10: Checking LiquidityPool USDT seeding...");
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
    // Step 11: BURN ALL DEPLOYER ADMIN ROLES (CRITICAL FOR SECURITY)
    // After this, the deployer private key has ZERO admin powers.
    // This is IRREVERSIBLE — the system becomes fully decentralized.
    // ============================================================
    console.log("--- Step 11: Burn ALL Deployer Admin Roles ---");
    console.log("  WARNING: This is IRREVERSIBLE. Deployer will lose all admin control.");
    console.log("");

    const DEFAULT_ADMIN_ROLE = await kairoToken.DEFAULT_ADMIN_ROLE();

    // 1. KAIROToken — renounce DEFAULT_ADMIN_ROLE
    tx = await kairoToken.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] KAIROToken DEFAULT_ADMIN_ROLE");

    // 2. StakingManager — renounce DEFAULT_ADMIN_ROLE
    tx = await stakingManager.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] StakingManager DEFAULT_ADMIN_ROLE");

    // 3. AffiliateDistributor — renounce DEFAULT_ADMIN_ROLE
    tx = await affiliateDistributor.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] AffiliateDistributor DEFAULT_ADMIN_ROLE");

    // 4. CoreMembershipSubscription — renounce DEFAULT_ADMIN_ROLE
    tx = await cms.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] CMS DEFAULT_ADMIN_ROLE");

    // 5. LiquidityPool — renounce DEFAULT_ADMIN_ROLE
    tx = await liquidityPool.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] LiquidityPool DEFAULT_ADMIN_ROLE");

    // 6. AtomicP2p — renounce ADMIN_ROLE + DEFAULT_ADMIN_ROLE
    const P2P_ADMIN_ROLE = await atomicP2p.ADMIN_ROLE();
    tx = await atomicP2p.renounceRole(P2P_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] AtomicP2p ADMIN_ROLE");
    tx = await atomicP2p.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] AtomicP2p DEFAULT_ADMIN_ROLE");

    console.log("");
    console.log("  ALL DEPLOYER ADMIN ROLES BURNED. System is now fully decentralized.");
    console.log("  The deployer private key can be safely revealed — it has ZERO powers.");
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
    console.log("  CoreMembershipSubscription:  ", cmsAddress);
    console.log("  AtomicP2p:                   ", p2pAddress);
    console.log("");
    console.log("Configuration:");
    console.log("  System Wallet:               ", systemWallet);
    console.log("  Deployer (BURNED - no admin):", deployer.address);
    console.log("  Social Lock:                  10,000 KAIRO (locked in LiquidityPool)");
    console.log("  Initial USDT Liquidity:       10,000 USDT");
    console.log("");
    console.log("Active Roles (contract-to-contract only, NO human admins):");
    console.log("  KAIROToken MINTER_ROLE:       StakingManager, AffiliateDistributor, CMS");
    console.log("  AffiliateDistributor STAKING_ROLE: StakingManager");
    console.log("  LiquidityPool CORE_ROLE:      StakingManager, CMS");
    console.log("  LiquidityPool P2P_ROLE:       AtomicP2p");
    console.log("");
    console.log("  ALL DEPLOYER ADMIN ROLES: BURNED (deployer key is safe to reveal)");
    console.log("=========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
