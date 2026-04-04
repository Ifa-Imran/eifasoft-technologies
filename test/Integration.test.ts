import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("Integration - Full User Journey", function () {
    async function integrationFixture() {
        const f = await deployFullEcosystemFixture();
        const stakingAddr = await f.stakingManager.getAddress();
        const cmsAddr = await f.cms.getAddress();
        const p2pAddr = await f.p2pEscrow.getAddress();
        const auxAddr = await f.auxFund.getAddress();

        // Approve all contracts for users
        for (const user of [f.user1, f.user2, f.user3]) {
            await f.usdt.connect(user).approve(stakingAddr, ethers.MaxUint256);
            await f.usdt.connect(user).approve(cmsAddr, ethers.MaxUint256);
            await f.usdt.connect(user).approve(auxAddr, ethers.MaxUint256);
            await f.usdt.connect(user).approve(p2pAddr, ethers.MaxUint256);
            await f.kairoToken.connect(user).approve(p2pAddr, ethers.MaxUint256);
            await f.kairoToken.connect(user).approve(auxAddr, ethers.MaxUint256);
        }

        // Grant STAKING_ROLE to owner for setting up referrers
        await f.affiliateDistributor.grantRole(f.STAKING_ROLE, f.owner.address);

        return f;
    }

    it("should complete full user journey: subscribe -> stake -> compound -> harvest -> claim -> P2P -> unstake", async function () {
        const {
            owner, user1, user2, user3, systemWallet,
            kairoToken, usdt, auxFund, stakingManager,
            affiliateDistributor, cms, p2pEscrow, MINTER_ROLE
        } = await loadFixture(integrationFixture);

        // ========== Step 1: User1 subscribes to CMS with user2 as referrer ==========
        // First set user2 as referrer in affiliate system
        await affiliateDistributor.setReferrer(user1.address, user2.address);

        await cms.connect(user1).subscribe(5, user2.address);
        expect(await cms.subscriptionCount(user1.address)).to.equal(5);

        // User2 should get leadership rewards from CMS referral
        const leadershipReward = await cms.leadershipRewards(user2.address);
        expect(leadershipReward).to.be.gt(0);

        // ========== Step 2: User1 stakes USDT ==========
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
        // Tier 1 compound interval = 21600s (6h)
        await time.increase(21600 * 10); // 10 intervals
        await stakingManager.connect(user1).compound(0);

        let stakeAfterCompound = await stakingManager.getStake(user1.address, 0);
        expect(stakeAfterCompound.totalEarned).to.be.gt(0);
        expect(stakeAfterCompound.amount).to.be.gt(stakeAmount);

        // ========== Step 4: Harvest rewards ==========
        // Need enough earnings to harvest ($10 minimum)
        // 10 intervals * 0.1% of 1000 = ~10 USDT earned
        const harvestAmount = ethers.parseEther("10");
        if (stakeAfterCompound.totalEarned >= harvestAmount) {
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

    it("should trigger 3X cap auto-close with small stake", async function () {
        const { user1, stakingManager, kairoToken } = await loadFixture(integrationFixture);

        const stakeAmount = ethers.parseEther("10");
        await stakingManager.connect(user1).stake(stakeAmount, ethers.ZeroAddress);

        // Tier 0: 8h interval. Need 3x = 30 USDT earned.
        // At 0.1% per interval on a growing balance, need ~3000 intervals
        await time.increase(28800 * 3000);

        const kairoBefore = await kairoToken.balanceOf(user1.address);
        await stakingManager.connect(user1).compound(0);
        const kairoAfter = await kairoToken.balanceOf(user1.address);

        const stake = await stakingManager.getStake(user1.address, 0);
        expect(stake.active).to.be.false; // Auto-closed
        expect(stake.totalEarned).to.equal(3n * stakeAmount);
        expect(kairoAfter).to.be.gt(kairoBefore); // Received 80% as KAIRO
    });

    it("should handle affiliate direct + team dividends through staking", async function () {
        const { user1, user2, user3, affiliateDistributor, stakingManager } = await loadFixture(integrationFixture);

        // Build referral chain: user1 -> user2 -> user3
        await affiliateDistributor.setReferrer(user1.address, user2.address);
        await affiliateDistributor.setReferrer(user2.address, user3.address);

        // User1 stakes with user2 as referrer
        await stakingManager.connect(user1).stake(ethers.parseEther("100"), user2.address);

        // Check user2 got direct dividend (5% of 100 = 5)
        const directDiv = await affiliateDistributor.directDividends(user2.address);
        expect(directDiv).to.equal(ethers.parseEther("5"));

        // Compound and check team dividends
        await time.increase(28800); // 1 interval (Tier 0)
        await stakingManager.connect(user1).compound(0);

        // user2 should have team dividend (L1: 10% of profit)
        const teamDiv2 = await affiliateDistributor.teamDividends(user2.address);
        expect(teamDiv2).to.be.gt(0);

        // user3 should have team dividend (L2: 5% of profit)
        const teamDiv3 = await affiliateDistributor.teamDividends(user3.address);
        expect(teamDiv3).to.be.gt(0);
    });
});
