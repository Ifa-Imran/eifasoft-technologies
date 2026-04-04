import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== KAIRO DeFi Ecosystem Deployment ===");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
    console.log("");

    // Use deployer as system wallet for testnet; override with env var for production
    const systemWallet = process.env.SYSTEM_WALLET || deployer.address;
    console.log("System Wallet:", systemWallet);
    console.log("");

    // ============================================================
    // Step 1: Deploy MockUSDT (testnet only)
    // Constructor: () - no params, mints 1M USDT to deployer
    // ============================================================
    console.log("Step 1: Deploying MockUSDT...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    const usdtAddress = await mockUSDT.getAddress();
    console.log("  MockUSDT deployed at:", usdtAddress);
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
    console.log("");

    // ============================================================
    // Step 3: Deploy AuxFund (LiquidityPool / Mini-DEX)
    // Constructor: (address _kairoToken, address _usdtToken)
    // Grants DEFAULT_ADMIN_ROLE to msg.sender (deployer)
    // ============================================================
    console.log("Step 3: Deploying AuxFund...");
    const AuxFund = await ethers.getContractFactory("AuxFund");
    const auxFund = await AuxFund.deploy(kairoAddress, usdtAddress);
    await auxFund.waitForDeployment();
    const auxFundAddress = await auxFund.getAddress();
    console.log("  AuxFund deployed at:", auxFundAddress);
    console.log("");

    // ============================================================
    // Step 4: Configure KAIROToken - set LP and mint initial supply
    // - setLiquidityPool(auxFund) — one-time, admin only
    // - mintInitialSupply() — mints 10,000 KAIRO to AuxFund (social lock)
    // ============================================================
    console.log("Step 4: Configuring KAIROToken...");
    const txSetLP = await kairoToken.setLiquidityPool(auxFundAddress);
    await txSetLP.wait();
    console.log("  LiquidityPool set to AuxFund");

    const txMint = await kairoToken.mintInitialSupply();
    await txMint.wait();
    console.log("  Initial supply minted (10,000 KAIRO social lock to AuxFund)");
    console.log("");

    // ============================================================
    // Step 5: Deploy AffiliateDistributor
    // Constructor: (address _kairoToken, address _auxFund, address _admin, address _systemWallet)
    // ============================================================
    console.log("Step 5: Deploying AffiliateDistributor...");
    const AffiliateDistributor = await ethers.getContractFactory("AffiliateDistributor");
    const affiliateDistributor = await AffiliateDistributor.deploy(
        kairoAddress,
        auxFundAddress,
        deployer.address,
        systemWallet
    );
    await affiliateDistributor.waitForDeployment();
    const affiliateAddress = await affiliateDistributor.getAddress();
    console.log("  AffiliateDistributor deployed at:", affiliateAddress);
    console.log("");

    // ============================================================
    // Step 6: Deploy StakingManager
    // Constructor: (address _kairoToken, address _auxFund, address _usdt, address _systemWallet, address _admin)
    // ============================================================
    console.log("Step 6: Deploying StakingManager...");
    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(
        kairoAddress,
        auxFundAddress,
        usdtAddress,
        systemWallet,
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
    console.log("");

    // ============================================================
    // Step 7: Deploy CoreMembershipSubscription (CMS)
    // Constructor: (address _kairoToken, address _usdt, address _auxFund,
    //               address _stakingManager, address _affiliateDistributor,
    //               address _systemWallet, address _admin)
    // ============================================================
    console.log("Step 7: Deploying CoreMembershipSubscription...");
    const CMS = await ethers.getContractFactory("CoreMembershipSubscription");
    const cms = await CMS.deploy(
        kairoAddress,
        usdtAddress,
        auxFundAddress,
        stakingAddress,
        affiliateAddress,
        systemWallet,
        deployer.address
    );
    await cms.waitForDeployment();
    const cmsAddress = await cms.getAddress();
    console.log("  CoreMembershipSubscription deployed at:", cmsAddress);
    console.log("");

    // ============================================================
    // Step 8: Deploy P2PEscrow
    // Constructor: (address _kairoToken, address _usdtToken, address _auxFund)
    // Grants DEFAULT_ADMIN_ROLE + ADMIN_ROLE to msg.sender
    // ============================================================
    console.log("Step 8: Deploying P2PEscrow...");
    const P2PEscrow = await ethers.getContractFactory("P2PEscrow");
    const p2pEscrow = await P2PEscrow.deploy(kairoAddress, usdtAddress, auxFundAddress);
    await p2pEscrow.waitForDeployment();
    const p2pAddress = await p2pEscrow.getAddress();
    console.log("  P2PEscrow deployed at:", p2pAddress);
    console.log("");

    // ============================================================
    // Step 9: Grant Roles across all contracts
    // ============================================================
    console.log("Step 9: Granting roles...");

    // --- KAIROToken Roles ---
    const MINTER_ROLE = await kairoToken.MINTER_ROLE();
    const BURNER_ROLE = await kairoToken.BURNER_ROLE();

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

    // Grant BURNER_ROLE to AuxFund (for burn on swapKAIROForUSDT)
    tx = await kairoToken.grantRole(BURNER_ROLE, auxFundAddress);
    await tx.wait();
    console.log("  KAIROToken: BURNER_ROLE -> AuxFund");

    // Grant BURNER_ROLE to P2PEscrow (for burn on trade fee)
    tx = await kairoToken.grantRole(BURNER_ROLE, p2pAddress);
    await tx.wait();
    console.log("  KAIROToken: BURNER_ROLE -> P2PEscrow");

    // --- AffiliateDistributor Roles ---
    const RANK_UPDATER_ROLE = await affiliateDistributor.RANK_UPDATER_ROLE();

    // Grant RANK_UPDATER_ROLE to deployer (backend will use this)
    tx = await affiliateDistributor.grantRole(RANK_UPDATER_ROLE, deployer.address);
    await tx.wait();
    console.log("  AffiliateDistributor: RANK_UPDATER_ROLE -> deployer");

    // --- StakingManager Roles ---
    const COMPOUNDER_ROLE = await stakingManager.COMPOUNDER_ROLE();

    // Grant COMPOUNDER_ROLE to deployer (backend will trigger compounding)
    tx = await stakingManager.grantRole(COMPOUNDER_ROLE, deployer.address);
    await tx.wait();
    console.log("  StakingManager: COMPOUNDER_ROLE -> deployer");

    // --- AuxFund Roles ---
    // Grant CORE_ROLE to StakingManager (for receiveStakingFunds, etc.)
    tx = await auxFund.grantCoreRole(stakingAddress);
    await tx.wait();
    console.log("  AuxFund: CORE_ROLE -> StakingManager");

    // Grant CORE_ROLE to CMS (for withdrawUSDT, receiveForfeitedTierBonus, etc.)
    tx = await auxFund.grantCoreRole(cmsAddress);
    await tx.wait();
    console.log("  AuxFund: CORE_ROLE -> CoreMembershipSubscription");

    // Grant P2P_ROLE to P2PEscrow (for receiveP2PFee)
    tx = await auxFund.grantP2PRole(p2pAddress);
    await tx.wait();
    console.log("  AuxFund: P2P_ROLE -> P2PEscrow");

    console.log("");

    // ============================================================
    // Step 10: Seed AuxFund with initial USDT liquidity
    // Transfer initial USDT to AuxFund so price oracle works correctly
    // ============================================================
    console.log("Step 10: Seeding AuxFund with initial USDT liquidity...");
    const INITIAL_LIQUIDITY = ethers.parseEther("10000"); // 10,000 USDT
    tx = await mockUSDT.transfer(auxFundAddress, INITIAL_LIQUIDITY);
    await tx.wait();
    console.log("  Transferred 10,000 USDT to AuxFund");

    // Verify initial price
    const initialPrice = await auxFund.getLivePrice();
    console.log("  Initial KAIRO price:", ethers.formatEther(initialPrice), "USDT");
    console.log("");

    // ============================================================
    // Summary: Print all deployed contract addresses
    // ============================================================
    console.log("=========================================");
    console.log("=== DEPLOYMENT COMPLETE ===");
    console.log("=========================================");
    console.log("");
    console.log("Contract Addresses:");
    console.log("  MockUSDT:                    ", usdtAddress);
    console.log("  KAIROToken:                  ", kairoAddress);
    console.log("  AuxFund:                     ", auxFundAddress);
    console.log("  AffiliateDistributor:        ", affiliateAddress);
    console.log("  StakingManager:              ", stakingAddress);
    console.log("  CoreMembershipSubscription:  ", cmsAddress);
    console.log("  P2PEscrow:                   ", p2pAddress);
    console.log("");
    console.log("Configuration:");
    console.log("  System Wallet:               ", systemWallet);
    console.log("  Deployer (admin):            ", deployer.address);
    console.log("  Initial KAIRO Price:         ", ethers.formatEther(initialPrice), "USDT");
    console.log("  Social Lock:                  10,000 KAIRO (locked in AuxFund)");
    console.log("  Initial USDT Liquidity:       10,000 USDT");
    console.log("");
    console.log("Roles Granted:");
    console.log("  KAIROToken MINTER_ROLE:       StakingManager, AffiliateDistributor, CMS");
    console.log("  KAIROToken BURNER_ROLE:       AuxFund, P2PEscrow");
    console.log("  AffiliateDistributor STAKING_ROLE: StakingManager");
    console.log("  AffiliateDistributor RANK_UPDATER_ROLE: deployer");
    console.log("  StakingManager COMPOUNDER_ROLE: deployer");
    console.log("  AuxFund CORE_ROLE:            StakingManager, CMS");
    console.log("  AuxFund P2P_ROLE:             P2PEscrow");
    console.log("=========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
