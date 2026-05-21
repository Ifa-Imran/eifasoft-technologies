import { ethers } from "hardhat";

export async function deployFullEcosystemFixture() {
    const [owner, systemWallet, user1, user2, user3, user4, user5, dao1, dao2, dao3, dao4, dao5, dao6, dao7, ...others] = await ethers.getSigners();

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

    // Step 4: Configure KAIROToken (mints LP social lock + 5 KAIRO to dev/system wallet)
    await kairoToken.setLiquidityPool(await liquidityPool.getAddress());
    await kairoToken.mintInitialSupply(systemWallet.address);

    // Step 5: Deploy AffiliateDistributor (testnet RANK_INTERVAL: 15 minutes)
    const RANK_INTERVAL_TEST = 15 * 60;
    const AffiliateDistributor = await ethers.getContractFactory("AffiliateDistributor");
    const affiliateDistributor = await AffiliateDistributor.deploy(
        await kairoToken.getAddress(),
        await liquidityPool.getAddress(),
        owner.address,
        systemWallet.address,
        RANK_INTERVAL_TEST
    );
    await affiliateDistributor.waitForDeployment();

    // Step 6: Deploy StakingManager
    const daoWallets = [dao1.address, dao2.address, dao3.address, dao4.address, dao5.address, dao6.address, dao7.address] as [string, string, string, string, string, string, string];
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

    // Testing deadlines: generous window to accommodate production compound intervals
    const latestBlock = await ethers.provider.getBlock("latest");
    const nowTs = latestBlock!.timestamp;
    const SUBSCRIBE_DEADLINE = nowTs + 365 * 24 * 60 * 60;  // +1 year
    const CLAIM_DEADLINE = nowTs + 365 * 24 * 60 * 60 + 30 * 24 * 60 * 60;  // +1 year + 30 days

    const cms = await CMS.deploy(
        await kairoToken.getAddress(),
        await usdt.getAddress(),
        await liquidityPool.getAddress(),
        await stakingManager.getAddress(),
        await affiliateDistributor.getAddress(),
        systemWallet.address,
        owner.address,
        SUBSCRIBE_DEADLINE,
        CLAIM_DEADLINE
    );
    await cms.waitForDeployment();

    // Link StakingManager -> CMS (for applyCappedHarvest authorization)
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
    const BURNER_ROLE = ethers.ZeroHash; // BURNER_ROLE removed from KAIROToken; burns are public via ERC20Burnable

    await kairoToken.grantRole(MINTER_ROLE, await stakingManager.getAddress());
    await kairoToken.grantRole(MINTER_ROLE, await affiliateDistributor.getAddress());
    await kairoToken.grantRole(MINTER_ROLE, await cms.getAddress());

    const RANK_UPDATER_ROLE = ethers.ZeroHash; // placeholder, role no longer exists

    const COMPOUNDER_ROLE = ethers.ZeroHash; // COMPOUNDER_ROLE removed from StakingManager

    await liquidityPool.grantCoreRole(await stakingManager.getAddress());
    await liquidityPool.grantCoreRole(await cms.getAddress());
    await liquidityPool.grantP2PRole(await p2pEscrow.getAddress());

    // Grant STAKING_ROLE to CMS in AffiliateDistributor so setReferrer works from CMS
    const STAKING_ROLE = await affiliateDistributor.STAKING_ROLE();
    await affiliateDistributor.grantRole(STAKING_ROLE, await cms.getAddress());

    // Register genesis account (root of referral tree) — uses others[6] (signer 20)
    // so it doesn't collide with signers[14..19] used as referral chain in tests.
    // Genesis account cannot stake but serves as the root ancestor.
    await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
    const genesisAccount = others[6];
    await affiliateDistributor.setReferrer(genesisAccount.address, ethers.ZeroAddress);

    // Step 10: Seed LiquidityPool with 10,000 USDT liquidity
    const INITIAL_LIQUIDITY = ethers.parseEther("10000");
    await usdt.transfer(await liquidityPool.getAddress(), INITIAL_LIQUIDITY);

    // CMS deadlines passed via constructor (3h subscribe, 6h claim from deploy)

    // Step 11: Mint test USDT to users (10,000 each)
    const userAmount = ethers.parseEther("100000");
    for (const user of [user1, user2, user3, user4, user5]) {
        await usdt.mint(user.address, userAmount);
    }

    return {
        owner, systemWallet, user1, user2, user3, user4, user5,
        dao1, dao2, dao3, dao4, dao5, dao6, dao7, daoWallets, others, genesisAccount,
        kairoToken, usdt, liquidityPool, stakingManager,
        affiliateDistributor, cms, p2pEscrow,
        MINTER_ROLE, BURNER_ROLE, COMPOUNDER_ROLE, RANK_UPDATER_ROLE, STAKING_ROLE
    };
}
