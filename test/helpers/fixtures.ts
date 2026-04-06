import { ethers } from "hardhat";

export async function deployFullEcosystemFixture() {
    const [owner, systemWallet, user1, user2, user3, user4, user5, dao1, dao2, dao3, dao4, dao5, ...others] = await ethers.getSigners();

    // Step 1: Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    await usdt.waitForDeployment();

    // Step 2: Deploy KAIROToken
    const KAIROToken = await ethers.getContractFactory("KAIROToken");
    const kairoToken = await KAIROToken.deploy(owner.address);
    await kairoToken.waitForDeployment();

    // Step 3: Deploy LiquidityPool
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(await kairoToken.getAddress(), await usdt.getAddress());
    await liquidityPool.waitForDeployment();

    // Step 4: Configure KAIROToken
    await kairoToken.setLiquidityPool(await liquidityPool.getAddress());
    await kairoToken.mintInitialSupply();

    // Step 5: Deploy AffiliateDistributor
    const AffiliateDistributor = await ethers.getContractFactory("AffiliateDistributor");
    const affiliateDistributor = await AffiliateDistributor.deploy(
        await kairoToken.getAddress(),
        await liquidityPool.getAddress(),
        owner.address,
        systemWallet.address
    );
    await affiliateDistributor.waitForDeployment();

    // Step 6: Deploy StakingManager
    const daoWallets = [dao1.address, dao2.address, dao3.address, dao4.address, dao5.address] as [string, string, string, string, string];
    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(
        await kairoToken.getAddress(),
        await liquidityPool.getAddress(),
        await usdt.getAddress(),
        systemWallet.address,
        daoWallets,
        owner.address
    );
    await stakingManager.waitForDeployment();

    // Link StakingManager <-> AffiliateDistributor
    await stakingManager.setAffiliateDistributor(await affiliateDistributor.getAddress());
    await affiliateDistributor.setStakingManager(await stakingManager.getAddress());

    // Step 7: Deploy CoreMembershipSubscription
    const CMS = await ethers.getContractFactory("CoreMembershipSubscription");
    const cms = await CMS.deploy(
        await kairoToken.getAddress(),
        await usdt.getAddress(),
        await liquidityPool.getAddress(),
        await stakingManager.getAddress(),
        await affiliateDistributor.getAddress(),
        systemWallet.address,
        owner.address
    );
    await cms.waitForDeployment();

    // Link StakingManager -> CMS (for addEarnings authorization)
    await stakingManager.setCMS(await cms.getAddress());

    // Step 8: Deploy AtomicP2p
    const AtomicP2p = await ethers.getContractFactory("AtomicP2p");
    const p2pEscrow = await AtomicP2p.deploy(
        await kairoToken.getAddress(),
        await usdt.getAddress(),
        await liquidityPool.getAddress()
    );
    await p2pEscrow.waitForDeployment();

    // Step 9: Grant all roles
    const MINTER_ROLE = await kairoToken.MINTER_ROLE();
    const BURNER_ROLE = await kairoToken.BURNER_ROLE();

    await kairoToken.grantRole(MINTER_ROLE, await stakingManager.getAddress());
    await kairoToken.grantRole(MINTER_ROLE, await affiliateDistributor.getAddress());
    await kairoToken.grantRole(MINTER_ROLE, await cms.getAddress());
    await kairoToken.grantRole(BURNER_ROLE, await liquidityPool.getAddress());
    await kairoToken.grantRole(BURNER_ROLE, await p2pEscrow.getAddress());

    const RANK_UPDATER_ROLE = ethers.ZeroHash; // placeholder, role no longer exists

    const COMPOUNDER_ROLE = await stakingManager.COMPOUNDER_ROLE();
    await stakingManager.grantRole(COMPOUNDER_ROLE, owner.address);

    await liquidityPool.grantCoreRole(await stakingManager.getAddress());
    await liquidityPool.grantCoreRole(await cms.getAddress());
    await liquidityPool.grantP2PRole(await p2pEscrow.getAddress());

    // Grant STAKING_ROLE to CMS in AffiliateDistributor so setReferrer works from CMS
    const STAKING_ROLE = await affiliateDistributor.STAKING_ROLE();
    await affiliateDistributor.grantRole(STAKING_ROLE, await cms.getAddress());

    // Register genesis account (root of referral tree) — uses others[0] so it doesn't interfere with tests
    // Genesis account cannot stake but serves as the root ancestor.
    await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
    const genesisAccount = others[0];
    await affiliateDistributor.setReferrer(genesisAccount.address, ethers.ZeroAddress);

    // Step 10: Seed LiquidityPool with 10,000 USDT liquidity
    const INITIAL_LIQUIDITY = ethers.parseEther("10000");
    await usdt.transfer(await liquidityPool.getAddress(), INITIAL_LIQUIDITY);

    // Extend CMS deadline far into the future for testing (year 2030)
    await cms.extendDeadline(1893456000);

    // Step 11: Mint test USDT to users (10,000 each)
    const userAmount = ethers.parseEther("100000");
    for (const user of [user1, user2, user3, user4, user5]) {
        await usdt.mint(user.address, userAmount);
    }

    return {
        owner, systemWallet, user1, user2, user3, user4, user5,
        dao1, dao2, dao3, dao4, dao5, daoWallets, others, genesisAccount,
        kairoToken, usdt, liquidityPool, stakingManager,
        affiliateDistributor, cms, p2pEscrow,
        MINTER_ROLE, BURNER_ROLE, COMPOUNDER_ROLE, RANK_UPDATER_ROLE, STAKING_ROLE
    };
}
