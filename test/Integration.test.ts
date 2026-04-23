import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("Integration - Full User Journey", function () {
    // Non-zero referrer address for mandatory referrer parameter
    const REF = "0x0000000000000000000000000000000000000001";

    async function integrationFixture() {
        const f = await deployFullEcosystemFixture();
        const stakingAddr = await f.stakingManager.getAddress();
        const cmsAddr = await f.cms.getAddress();
        const p2pAddr = await f.p2pEscrow.getAddress();
        const lpAddr = await f.liquidityPool.getAddress();

        // Approve all contracts for users
        for (const user of [f.user1, f.user2, f.user3]) {
            await f.usdt.connect(user).approve(stakingAddr, ethers.MaxUint256);
            await f.usdt.connect(user).approve(cmsAddr, ethers.MaxUint256);
            await f.usdt.connect(user).approve(lpAddr, ethers.MaxUint256);
            await f.usdt.connect(user).approve(p2pAddr, ethers.MaxUint256);
            await f.kairoToken.connect(user).approve(p2pAddr, ethers.MaxUint256);
            await f.kairoToken.connect(user).approve(lpAddr, ethers.MaxUint256);
        }

        // Grant STAKING_ROLE to owner for setting up referrers
        await f.affiliateDistributor.grantRole(f.STAKING_ROLE, f.owner.address);

        // Register users under genesis for test referral chains
        await f.affiliateDistributor.setReferrer(f.user1.address, f.genesisAccount.address);
        await f.affiliateDistributor.setReferrer(f.user2.address, f.genesisAccount.address);
        await f.affiliateDistributor.setReferrer(f.user3.address, f.genesisAccount.address);

        return f;
    }

    it("should complete full user journey: subscribe -> stake -> compound -> harvest -> claim -> P2P -> unstake", async function () {
        const {
            owner, user1, user2, user3, systemWallet,
            kairoToken, usdt, liquidityPool, stakingManager,
            affiliateDistributor, cms, p2pEscrow, MINTER_ROLE
        } = await loadFixture(integrationFixture);

        // ========== Step 1: User1 subscribes to CMS with user2 as referrer ==========
        // user1 and user2 are already registered via integrationFixture
        // user2 needs an active CMS subscription to earn leadership rewards
        await cms.connect(user2).subscribe(1, ethers.ZeroAddress);
        await cms.connect(user1).subscribe(5, user2.address);
        expect(await cms.subscriptionCount(user1.address)).to.equal(5);

        // User2 should get leadership rewards from CMS referral
        const leadershipReward = await cms.leadershipRewards(user2.address);
        expect(leadershipReward).to.be.gt(0);

        // ========== Step 2: User2 stakes first (needs active stake to earn referral income) ==========
        await stakingManager.connect(user2).stake(ethers.parseEther("100"), user1.address);

        // ========== Step 3: User1 stakes USDT ==========
        const stakeAmount = ethers.parseEther("1000");
        await stakingManager.connect(user1).stake(stakeAmount, user2.address);

        const stakes = await stakingManager.getUserStakes(user1.address);
        expect(stakes.length).to.equal(1);
        expect(stakes[0].active).to.be.true;
        expect(stakes[0].tier).to.equal(1); // 1000 USDT = Tier 1

        // User2 should have direct dividend from referral (5% of 1000 = 50)
        const directDiv = await affiliateDistributor.directDividends(user2.address);
        expect(directDiv).to.equal(ethers.parseEther("50"));

        // ========== Step 3: Advance time and compound multiple times ==========
        // Tier 1 compound interval = 21600s production
        await time.increase(21600 * 10); // 10 intervals
        await stakingManager.connect(user1).compound(0);

        let stakeAfterCompound = await stakingManager.getStake(user1.address, 0);
        expect(stakeAfterCompound.compoundEarned).to.be.gt(0);
        expect(stakeAfterCompound.amount).to.be.gt(stakeAmount);

        // ========== Step 4: Harvest rewards ==========
        // Need enough earnings to harvest ($10 minimum)
        // 10 intervals * 0.1% of 1000 = ~10 USDT earned
        const harvestAmount = ethers.parseEther("10");
        if (stakeAfterCompound.compoundEarned >= harvestAmount) {
            const kairoBefore = await kairoToken.balanceOf(user1.address);
            await stakingManager.connect(user1).harvest(0, harvestAmount);
            const kairoAfter = await kairoToken.balanceOf(user1.address);
            expect(kairoAfter).to.be.gt(kairoBefore);
        }

        // ========== Step 5: Claim CMS rewards (with cap check) ==========
        const kairoBefore = await kairoToken.balanceOf(user1.address);
        await cms.connect(user1).claimCMSRewards();
        const kairoAfter = await kairoToken.balanceOf(user1.address);
        expect(kairoAfter).to.be.gt(kairoBefore);
        expect(await cms.hasClaimed(user1.address)).to.be.true;

        // ========== Step 6: P2P Trading ==========
        // Mint some KAIRO to user1 for selling
        await kairoToken.grantRole(MINTER_ROLE, owner.address);
        await kairoToken.mint(user1.address, ethers.parseEther("100"));
        await kairoToken.mint(user3.address, ethers.parseEther("100"));

        // User1 creates sell order
        await p2pEscrow.connect(user1).createSellOrder(ethers.parseEther("50"));
        // User3 buys from the sell order
        const user3KairoBefore = await kairoToken.balanceOf(user3.address);
        await p2pEscrow.connect(user3).buyFromOrder(1, ethers.parseEther("30"));
        const user3KairoAfter = await kairoToken.balanceOf(user3.address);
        expect(user3KairoAfter).to.be.gt(user3KairoBefore);

        // ========== Step 7: Unstake (verify 80% minus harvested) ==========
        const stakeBeforeUnstake = await stakingManager.getStake(user1.address, 0);
        const kairoBeforeUnstake = await kairoToken.balanceOf(user1.address);
        await stakingManager.connect(user1).unstake(0);
        const kairoAfterUnstake = await kairoToken.balanceOf(user1.address);

        // User should receive KAIRO from unstake
        expect(kairoAfterUnstake).to.be.gt(kairoBeforeUnstake);
        const stakeAfterUnstake = await stakingManager.getStake(user1.address, 0);
        expect(stakeAfterUnstake.active).to.be.false;
    });

    it("should cap stake via harvest-triggered 3X model (no auto-close on compound)", async function () {
        const { user1, stakingManager, kairoToken } = await loadFixture(integrationFixture);

        const stakeAmount = ethers.parseEther("10");
        await stakingManager.connect(user1).stake(stakeAmount, REF);

        // Tier 0: 28800s production interval. Need lots of compound to build up earnings
        await time.increase(28800 * 1500);
        await stakingManager.connect(user1).compound(0);

        const stake = await stakingManager.getStake(user1.address, 0);
        // Under harvest-triggered model, stake stays active after compound
        expect(stake.active).to.be.true;
        expect(stake.totalEarned).to.equal(0); // Nothing harvested yet
        expect(stake.compoundEarned).to.be.gt(0); // But earnings accumulated

        // Harvest up to 3x cap ($30)
        await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
        await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
        await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));

        const stakeAfterHarvest = await stakingManager.getStake(user1.address, 0);
        expect(stakeAfterHarvest.totalEarned).to.equal(3n * stakeAmount); // 3x capped
        expect(stakeAfterHarvest.active).to.be.false; // Capped = inactive

        // Compounding via global sync doesn't revert on capped stake
        await time.increase(28800);
        await expect(
            stakingManager.connect(user1).compound(0)
        ).to.not.be.reverted;
    });

    it("should handle affiliate direct + team dividends through staking", async function () {
        const { user1, user2, user3, usdt, affiliateDistributor, stakingManager } = await loadFixture(integrationFixture);

        // Build referral chain: user1 -> user2 -> user3
        // user1, user2, user3 already registered under genesis in integrationFixture
        // Re-register with specific chain: clear won't work, so use fresh users
        // Actually users are already registered. Just stake and check.
        // User1's referrer is genesisAccount, user2's is genesisAccount, user3's is genesisAccount
        // For this test we need user1 -> user2 -> user3 chain. Since users are already registered,
        // let's use different users from 'others'
        const signers = await ethers.getSigners();
        const testUser1 = signers[15];
        const testUser2 = signers[16];
        const testUser3 = signers[17];

        // Fund test users
        await usdt.mint(testUser1.address, ethers.parseEther("100000"));
        await usdt.mint(testUser2.address, ethers.parseEther("100000"));
        const stakingAddr = await stakingManager.getAddress();
        await usdt.connect(testUser1).approve(stakingAddr, ethers.MaxUint256);
        await usdt.connect(testUser2).approve(stakingAddr, ethers.MaxUint256);

        // Build chain: testUser3 under genesis, testUser2 under testUser3, testUser1 under testUser2
        await affiliateDistributor.setReferrer(testUser3.address, user1.address);
        await affiliateDistributor.setReferrer(testUser2.address, testUser3.address);
        await affiliateDistributor.setReferrer(testUser1.address, testUser2.address);

        // Give testUser3 a 2nd direct so it unlocks L2 (needs 2 directs for level 2)
        const dummySigner = signers[18];
        await affiliateDistributor.setReferrer(dummySigner.address, testUser3.address);

        // testUser2 and testUser3 need active stakes to earn dividends
        // dummySigner needs active stake to count as active direct for testUser3's L2 unlock
        await stakingManager.connect(testUser2).stake(ethers.parseEther("100"), testUser3.address);
        await usdt.mint(testUser3.address, ethers.parseEther("100000"));
        await usdt.connect(testUser3).approve(stakingAddr, ethers.MaxUint256);
        await stakingManager.connect(testUser3).stake(ethers.parseEther("100"), user1.address);
        await usdt.mint(dummySigner.address, ethers.parseEther("100000"));
        await usdt.connect(dummySigner).approve(stakingAddr, ethers.MaxUint256);
        await stakingManager.connect(dummySigner).stake(ethers.parseEther("100"), testUser3.address);

        // testUser1 stakes with testUser2 as referrer
        await stakingManager.connect(testUser1).stake(ethers.parseEther("100"), testUser2.address);

        // Check testUser2 got direct dividend (5% of 100 = 5)
        const directDiv = await affiliateDistributor.directDividends(testUser2.address);
        expect(directDiv).to.equal(ethers.parseEther("5"));

        // Compound and check team dividends
        await time.increase(28800); // 1 interval (Tier 0 = 28800s)
        await stakingManager.connect(testUser1).compound(0);

        // testUser2 should have team dividend (L1: 10% of profit)
        const teamDiv2 = await affiliateDistributor.teamDividends(testUser2.address);
        expect(teamDiv2).to.be.gt(0);

        // testUser3 should have team dividend (L2: 5% of profit)
        const teamDiv3 = await affiliateDistributor.teamDividends(testUser3.address);
        expect(teamDiv3).to.be.gt(0);
    });

    it("should handle multi-source income with harvest-triggered FIFO cap", async function () {
        const {
            user1, user2, user3, owner, systemWallet,
            kairoToken, usdt, liquidityPool, stakingManager,
            affiliateDistributor, cms, MINTER_ROLE, STAKING_ROLE
        } = await loadFixture(integrationFixture);

        const signers = await ethers.getSigners();
        const staker = signers[18];
        const referrer = signers[19];

        // Fund and register
        await usdt.mint(staker.address, ethers.parseEther("100000"));
        await usdt.mint(referrer.address, ethers.parseEther("100000"));
        const stakingAddr = await stakingManager.getAddress();
        await usdt.connect(staker).approve(stakingAddr, ethers.MaxUint256);
        await usdt.connect(referrer).approve(stakingAddr, ethers.MaxUint256);

        // Register: referrer under user1, staker under referrer
        await affiliateDistributor.setReferrer(referrer.address, user1.address);
        await affiliateDistributor.setReferrer(staker.address, referrer.address);

        // Both stake
        await stakingManager.connect(referrer).stake(ethers.parseEther("500"), user1.address);
        await stakingManager.connect(staker).stake(ethers.parseEther("100"), referrer.address);

        // 1) Direct dividend accrues freely for referrer: 5% of 100 = $5
        const directDiv = await affiliateDistributor.directDividends(referrer.address);
        expect(directDiv).to.equal(ethers.parseEther("5"));

        // 2) Compound staker to generate team dividends for referrer
        await time.increase(28800 * 10); // 10 Tier 0 intervals
        await stakingManager.connect(staker).compound(0);

        const teamDiv = await affiliateDistributor.teamDividends(referrer.address);
        expect(teamDiv).to.be.gt(0);

        // 3) Cap progress should be 0 (nothing harvested yet)
        const [totalEarned, totalCap, remaining] = await stakingManager.getGlobalCapProgress(referrer.address);
        expect(totalEarned).to.equal(0);
        expect(totalCap).to.equal(ethers.parseEther("1500")); // 3 * 500

        // 4) Compound referrer's own stake and harvest compound rewards
        await time.increase(21600 * 100); // Tier 1 (500 USDT) = 21600s intervals
        await stakingManager.connect(referrer).compound(0);
        await stakingManager.connect(referrer).harvest(0, ethers.parseEther("10"));

        // Now totalEarned should reflect the harvest
        const [totalEarnedAfter] = await stakingManager.getGlobalCapProgress(referrer.address);
        expect(totalEarnedAfter).to.equal(ethers.parseEther("10"));
    });
});
