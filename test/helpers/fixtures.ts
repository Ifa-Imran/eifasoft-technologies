import { ethers } from "hardhat";

export async function deployFullEcosystemFixture() {
    const [owner, systemWallet, user1, user2, user3, user4, user5, ...others] = await ethers.getSigners();

    // Step 1: Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const usdt = await MockUSDT.deploy();
    await usdt.waitForDeployment();

    // Step 2: Deploy KAIROToken
    const KAIROToken = await ethers.getContractFactory("KAIROToken");
    const kairoToken = await KAIROToken.deploy(owner.address);
    await kairoToken.waitForDeployment();

    // Step 3: Deploy AuxFund
    const AuxFund = await ethers.getContractFactory("AuxFund");
    const auxFund = await AuxFund.deploy(await kairoToken.getAddress(), await usdt.getAddress());
    await auxFund.waitForDeployment();

    // Step 4: Configure KAIROToken
    await kairoToken.setLiquidityPool(await auxFund.getAddress());
    await kairoToken.mintInitialSupply();

    // Step 5: Deploy AffiliateDistributor
    const AffiliateDistributor = await ethers.getContractFactory("AffiliateDistributor");
    const affiliateDistributor = await AffiliateDistributor.deploy(
        await kairoToken.getAddress(),
        await auxFund.getAddress(),
        owner.address,
        systemWallet.address
    );
    await affiliateDistributor.waitForDeployment();

    // Step 6: Deploy StakingManager
    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(
        await kairoToken.getAddress(),
        await auxFund.getAddress(),
        await usdt.getAddress(),
        systemWallet.address,
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
        await auxFund.getAddress(),
        await stakingManager.getAddress(),
        await affiliateDistributor.getAddress(),
        systemWallet.address,
        owner.address
    );
    await cms.waitForDeployment();

    // Step 8: Deploy P2PEscrow
    const P2PEscrow = await ethers.getContractFactory("P2PEscrow");
    const p2pEscrow = await P2PEscrow.deploy(
        await kairoToken.getAddress(),
        await usdt.getAddress(),
        await auxFund.getAddress()
    );
    await p2pEscrow.waitForDeployment();

    // Step 9: Grant all roles
    const MINTER_ROLE = await kairoToken.MINTER_ROLE();
    const BURNER_ROLE = await kairoToken.BURNER_ROLE();

    await kairoToken.grantRole(MINTER_ROLE, await stakingManager.getAddress());
    await kairoToken.grantRole(MINTER_ROLE, await affiliateDistributor.getAddress());
    await kairoToken.grantRole(MINTER_ROLE, await cms.getAddress());
    await kairoToken.grantRole(BURNER_ROLE, await auxFund.getAddress());
    await kairoToken.grantRole(BURNER_ROLE, await p2pEscrow.getAddress());

    const RANK_UPDATER_ROLE = await affiliateDistributor.RANK_UPDATER_ROLE();
    await affiliateDistributor.grantRole(RANK_UPDATER_ROLE, owner.address);

    const COMPOUNDER_ROLE = await stakingManager.COMPOUNDER_ROLE();
    await stakingManager.grantRole(COMPOUNDER_ROLE, owner.address);

    await auxFund.grantCoreRole(await stakingManager.getAddress());
    await auxFund.grantCoreRole(await cms.getAddress());
    await auxFund.grantP2PRole(await p2pEscrow.getAddress());

    // Grant STAKING_ROLE to CMS in AffiliateDistributor so setReferrer works from CMS
    const STAKING_ROLE = await affiliateDistributor.STAKING_ROLE();
    await affiliateDistributor.grantRole(STAKING_ROLE, await cms.getAddress());

    // Step 10: Seed AuxFund with 10,000 USDT liquidity
    const INITIAL_LIQUIDITY = ethers.parseEther("10000");
    await usdt.transfer(await auxFund.getAddress(), INITIAL_LIQUIDITY);

    // Extend CMS deadline far into the future for testing (year 2030)
    await cms.extendDeadline(1893456000);

    // Step 11: Mint test USDT to users (10,000 each)
    const userAmount = ethers.parseEther("100000");
    for (const user of [user1, user2, user3, user4, user5]) {
        await usdt.mint(user.address, userAmount);
    }

    return {
        owner, systemWallet, user1, user2, user3, user4, user5, others,
        kairoToken, usdt, auxFund, stakingManager,
        affiliateDistributor, cms, p2pEscrow,
        MINTER_ROLE, BURNER_ROLE, COMPOUNDER_ROLE, RANK_UPDATER_ROLE, STAKING_ROLE
    };
}
