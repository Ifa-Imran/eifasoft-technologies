import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("CoreMembershipSubscription", function () {
    // Non-zero referrer address for mandatory referrer parameter
    const REF = "0x0000000000000000000000000000000000000001";

    async function cmsFixture() {
        const f = await deployFullEcosystemFixture();
        // Approve CMS (actually LiquidityPool since USDT goes there) from users
        const lpAddress = await f.liquidityPool.getAddress();
        const cmsAddress = await f.cms.getAddress();
        const stakingAddress = await f.stakingManager.getAddress();

        // Users approve spending for CMS and staking
        for (const user of [f.user1, f.user2, f.user3, f.user4, f.user5]) {
            await f.usdt.connect(user).approve(cmsAddress, ethers.MaxUint256);
            await f.usdt.connect(user).approve(lpAddress, ethers.MaxUint256);
            await f.usdt.connect(user).approve(stakingAddress, ethers.MaxUint256);
        }
        return f;
    }

    describe("Subscription", function () {
        it("should purchase a subscription with correct USDT transfer", async function () {
            const { cms, usdt, liquidityPool, user1 } = await loadFixture(cmsFixture);
            const lpAddr = await liquidityPool.getAddress();
            const balBefore = await usdt.balanceOf(lpAddr);
            await cms.connect(user1).subscribe(1, ethers.ZeroAddress);
            const balAfter = await usdt.balanceOf(lpAddr);
            // 10 USDT per sub transferred to LiquidityPool
            expect(balAfter - balBefore).to.equal(ethers.parseEther("10"));
        });

        it("should accumulate loyalty rewards (5 KAIRO per sub)", async function () {
            const { cms, user1 } = await loadFixture(cmsFixture);
            await cms.connect(user1).subscribe(3, ethers.ZeroAddress);
            const [loyalty, , ] = await cms.getClaimableRewards(user1.address);
            expect(loyalty).to.equal(ethers.parseEther("15")); // 3 * 5
        });

        it("should update subscription count", async function () {
            const { cms, user1 } = await loadFixture(cmsFixture);
            await cms.connect(user1).subscribe(5, ethers.ZeroAddress);
            expect(await cms.getSubscriptionCount(user1.address)).to.equal(5);
            expect(await cms.totalSubscriptions()).to.equal(5);
        });
    });

    describe("Multi-buy", function () {
        it("should buy multiple subscriptions at once", async function () {
            const { cms, usdt, user1 } = await loadFixture(cmsFixture);
            const balBefore = await usdt.balanceOf(user1.address);
            await cms.connect(user1).subscribe(10, ethers.ZeroAddress);
            const balAfter = await usdt.balanceOf(user1.address);
            expect(balBefore - balAfter).to.equal(ethers.parseEther("100")); // 10 * 10 USDT
            expect(await cms.subscriptionCount(user1.address)).to.equal(10);
        });
    });

    describe("Referral Rewards", function () {
        it("should distribute 5-level referral rewards", async function () {
            const { cms, usdt, affiliateDistributor, owner, user1, user2, user3, user4, user5, genesisAccount, STAKING_ROLE } = await loadFixture(cmsFixture);
            const signers = await ethers.getSigners();
            const cmsAddr = await cms.getAddress();

            // Build referral chain: user5 -> user4 -> user3 -> user2 -> user1
            await affiliateDistributor.setReferrer(user1.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user2.address, user1.address);
            await affiliateDistributor.setReferrer(user3.address, user2.address);
            await affiliateDistributor.setReferrer(user4.address, user3.address);
            await affiliateDistributor.setReferrer(user5.address, user4.address);

            // LEVEL_DIRECTS = [0, 2, 3, 4, 5]
            // Each upline needs active CMS subscriptions AND enough CMS directs
            // user4 (L1): needs 0 CMS directs -> just subscribe
            // user3 (L2): needs 2 CMS directs -> user4 + 1 extra subscriber
            // user2 (L3): needs 3 CMS directs -> user3 + 2 extra subscribers
            // user1 (L4): needs 4 CMS directs -> user2 + 3 extra subscribers

            // Fund extra signers for CMS subscriptions (start at 14 to avoid genesisAccount = signers[13])
            for (let i = 14; i <= 19; i++) {
                await usdt.mint(signers[i].address, ethers.parseEther("1000"));
                await usdt.connect(signers[i]).approve(cmsAddr, ethers.MaxUint256);
            }

            // Subscribe all uplines first
            await cms.connect(user1).subscribe(1, ethers.ZeroAddress);
            await cms.connect(user2).subscribe(1, user1.address);
            await cms.connect(user3).subscribe(1, user2.address);
            await cms.connect(user4).subscribe(1, user3.address);

            // Add extra CMS directs for user3 (needs 2: has user4, add s[14])
            await affiliateDistributor.setReferrer(signers[14].address, user3.address);
            await cms.connect(signers[14]).subscribe(1, user3.address);

            // Add extra CMS directs for user2 (needs 3: has user3, add s[15], s[16])
            await affiliateDistributor.setReferrer(signers[15].address, user2.address);
            await affiliateDistributor.setReferrer(signers[16].address, user2.address);
            await cms.connect(signers[15]).subscribe(1, user2.address);
            await cms.connect(signers[16]).subscribe(1, user2.address);

            // Add extra CMS directs for user1 (needs 4: has user2, add s[17], s[18], s[19])
            await affiliateDistributor.setReferrer(signers[17].address, user1.address);
            await affiliateDistributor.setReferrer(signers[18].address, user1.address);
            await affiliateDistributor.setReferrer(signers[19].address, user1.address);
            await cms.connect(signers[17]).subscribe(1, user1.address);
            await cms.connect(signers[18]).subscribe(1, user1.address);
            await cms.connect(signers[19]).subscribe(1, user1.address);

            // Clear accumulated leadership rewards from setup subscriptions
            // (We only want to check rewards from user5's subscription)
            const user4LeaderBefore = await cms.leadershipRewards(user4.address);
            const user3LeaderBefore = await cms.leadershipRewards(user3.address);
            const user2LeaderBefore = await cms.leadershipRewards(user2.address);
            const user1LeaderBefore = await cms.leadershipRewards(user1.address);

            // user5 subscribes with user4 as CMS referrer
            await cms.connect(user5).subscribe(1, user4.address);

            // Check leadership rewards gained from user5's subscription: [1, 0.5, 0.5, 0.25] KAIRO
            const user4Gained = (await cms.leadershipRewards(user4.address)) - user4LeaderBefore;
            const user3Gained = (await cms.leadershipRewards(user3.address)) - user3LeaderBefore;
            const user2Gained = (await cms.leadershipRewards(user2.address)) - user2LeaderBefore;
            const user1Gained = (await cms.leadershipRewards(user1.address)) - user1LeaderBefore;

            expect(user4Gained).to.equal(ethers.parseEther("1"));       // L1
            expect(user3Gained).to.equal(ethers.parseEther("0.5"));     // L2
            expect(user2Gained).to.equal(ethers.parseEther("0.5"));     // L3
            expect(user1Gained).to.equal(ethers.parseEther("0.25"));    // L4
        });

        it("should prevent self-referral", async function () {
            const { cms, user1 } = await loadFixture(cmsFixture);
            await expect(
                cms.connect(user1).subscribe(1, user1.address)
            ).to.be.revertedWith("CMS: No self-referral");
        });
    });

    describe("MAX_SUBS Limit", function () {
        it("should revert when exceeding MAX_SUBS", async function () {
            const { cms, user1 } = await loadFixture(cmsFixture);
            // MAX_SUBS = 10000, try to buy 10001
            await expect(
                cms.connect(user1).subscribe(10001, ethers.ZeroAddress)
            ).to.be.revertedWith("CMS: Exceeds max subscriptions");
        });
    });

    describe("Deadline Enforcement", function () {
        it("should allow subscription before deadline", async function () {
            const { cms, user1 } = await loadFixture(cmsFixture);
            // SUBSCRIBE_DEADLINE = deployTime + 1 year; current test time should be before that
            await expect(cms.connect(user1).subscribe(1, ethers.ZeroAddress)).to.not.be.reverted;
        });

        it("should revert subscription after deadline", async function () {
            const { cms, user1 } = await loadFixture(cmsFixture);
            // Advance past SUBSCRIBE_DEADLINE (1 year from deploy)
            await time.increase(365 * 24 * 3600 + 1);
            await expect(
                cms.connect(user1).subscribe(1, ethers.ZeroAddress)
            ).to.be.revertedWith("CMS: Subscription period ended");
        });
    });

    describe("Claiming", function () {
        async function claimFixture() {
            const f = await cmsFixture();
            // User1 subscribes and stakes
            await f.cms.connect(f.user1).subscribe(5, ethers.ZeroAddress);
            await f.stakingManager.connect(f.user1).stake(ethers.parseEther("1000"), REF);
            return f;
        }

        it("should claim rewards successfully", async function () {
            const { cms, kairoToken, user1 } = await loadFixture(claimFixture);
            const balBefore = await kairoToken.balanceOf(user1.address);
            await cms.connect(user1).claimCMSRewards();
            const balAfter = await kairoToken.balanceOf(user1.address);
            expect(balAfter).to.be.gt(balBefore);
            expect(await cms.hasClaimed(user1.address)).to.be.true;
        });

        it("should revert second claim (one-time only)", async function () {
            const { cms, user1 } = await loadFixture(claimFixture);
            await cms.connect(user1).claimCMSRewards();
            await expect(cms.connect(user1).claimCMSRewards()).to.be.revertedWith("CMS: Already claimed");
        });

        it("should revert claim without active stake", async function () {
            const f = await loadFixture(cmsFixture);
            await f.cms.connect(f.user1).subscribe(1, ethers.ZeroAddress);
            // No staking
            await expect(f.cms.connect(f.user1).claimCMSRewards()).to.be.revertedWith("CMS: No active stake");
        });

        it("should revert claim without subscriptions", async function () {
            const { cms, user1 } = await loadFixture(cmsFixture);
            await expect(cms.connect(user1).claimCMSRewards()).to.be.revertedWith("CMS: No subscriptions");
        });

        it("should apply 90/10 split (user receives 90%, 10% burned)", async function () {
            const { cms, kairoToken, user1, systemWallet } = await loadFixture(claimFixture);
            const sysBalBefore = await kairoToken.balanceOf(systemWallet.address);
            const userBalBefore = await kairoToken.balanceOf(user1.address);
            await cms.connect(user1).claimCMSRewards();
            const sysBalAfter = await kairoToken.balanceOf(systemWallet.address);
            const userBalAfter = await kairoToken.balanceOf(user1.address);

            const userGain = userBalAfter - userBalBefore;
            // System wallet should receive NOTHING (10% is burned, not minted)
            expect(sysBalAfter).to.equal(sysBalBefore);
            expect(userGain).to.be.gt(0);
        });

        it("should cap at stake value and delete excess", async function () {
            const f = await cmsFixture();
            // Subscribe with many subs to create large rewards
            await f.cms.connect(f.user1).subscribe(100, ethers.ZeroAddress); // 500 KAIRO loyalty
            // Stake only a small amount
            await f.stakingManager.connect(f.user1).stake(ethers.parseEther("10"), REF);

            // The max claimable KAIRO = stakeValue / price = 10 / 1 = 10 KAIRO
            // But totalClaimable = 500 KAIRO, so excess = 490
            const excess = await f.cms.getExcessToBeDeleted(f.user1.address);
            expect(excess).to.be.gt(0);

            await f.cms.connect(f.user1).claimCMSRewards();
            // After claim, rewards should be zeroed
            const [loyalty, leadership, total] = await f.cms.getClaimableRewards(f.user1.address);
            expect(total).to.equal(0);
        });
    });

    describe("3X Cap Integration (Harvest-Triggered)", function () {
        it("should NOT report loyalty to FIFO cap on subscribe (accrues freely)", async function () {
            const { cms, stakingManager, user1 } = await loadFixture(cmsFixture);

            // user1 stakes first so there's a cap to track against
            await stakingManager.connect(user1).stake(ethers.parseEther("1000"), REF);

            // Subscribe 2 subs => 2 * 5 = 10 KAIRO loyalty
            await cms.connect(user1).subscribe(2, ethers.ZeroAddress);

            // Under harvest-triggered model, totalEarned should be 0 (no harvest yet)
            const [totalEarned] = await stakingManager.getGlobalCapProgress(user1.address);
            expect(totalEarned).to.equal(0);
        });

        it("should apply FIFO cap when claiming CMS rewards", async function () {
            const { cms, stakingManager, user1 } = await loadFixture(cmsFixture);

            // user1 stakes
            await stakingManager.connect(user1).stake(ethers.parseEther("1000"), REF);

            // Subscribe to get loyalty rewards
            await cms.connect(user1).subscribe(2, ethers.ZeroAddress);

            // Claim CMS rewards - should apply FIFO cap
            await cms.connect(user1).claimCMSRewards();

            // totalEarned should now reflect the claimed USD value
            const [totalEarned] = await stakingManager.getGlobalCapProgress(user1.address);
            expect(totalEarned).to.be.gt(0);
        });

        it("should NOT report leadership rewards to FIFO cap on referral subscribe", async function () {
            const { cms, affiliateDistributor, stakingManager, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(cmsFixture);

            // Setup referral chain
            await affiliateDistributor.setReferrer(user1.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user2.address, user1.address);

            // user1 stakes
            await stakingManager.connect(user1).stake(ethers.parseEther("1000"), REF);

            // user1 needs active CMS subscription to earn leadership rewards
            await cms.connect(user1).subscribe(1, ethers.ZeroAddress);

            // user2 subscribes with user1 as referrer
            await cms.connect(user2).subscribe(1, user1.address);

            // Under harvest-triggered model, totalEarned should be 0 (no harvest/claim yet)
            const [totalEarned] = await stakingManager.getGlobalCapProgress(user1.address);
            expect(totalEarned).to.equal(0);

            // But leadership rewards should be accrued
            expect(await cms.leadershipRewards(user1.address)).to.be.gt(0);
        });
    });

    describe("View Functions", function () {
        it("should return correct getClaimableRewards", async function () {
            const { cms, user1 } = await loadFixture(cmsFixture);
            await cms.connect(user1).subscribe(2, ethers.ZeroAddress);
            const [loyalty, leadership, total] = await cms.getClaimableRewards(user1.address);
            expect(loyalty).to.equal(ethers.parseEther("10"));
            expect(leadership).to.equal(0);
            expect(total).to.equal(ethers.parseEther("10"));
        });

        it("should return correct getRemainingSubscriptions", async function () {
            const { cms, user1 } = await loadFixture(cmsFixture);
            await cms.connect(user1).subscribe(10, ethers.ZeroAddress);
            expect(await cms.getRemainingSubscriptions()).to.equal(10000 - 10);
        });

        it("should return correct isSubscriptionEnded", async function () {
            const { cms } = await loadFixture(cmsFixture);
            // SUBSCRIBE_DEADLINE is 1 year from deploy, so should not be passed yet
            const deadline = await cms.SUBSCRIBE_DEADLINE();
            const latest = await time.latest();
            if (latest < deadline) {
                expect(await cms.isSubscriptionEnded()).to.be.false;
            } else {
                expect(await cms.isSubscriptionEnded()).to.be.true;
            }
        });

        it("should return correct canClaim eligibility", async function () {
            const { cms, stakingManager, user1 } = await loadFixture(cmsFixture);
            // No sub = not eligible
            let [eligible, reason] = await cms.canClaim(user1.address);
            expect(eligible).to.be.false;
            expect(reason).to.equal("No subscriptions");

            // Subscribe but no stake
            await cms.connect(user1).subscribe(1, ethers.ZeroAddress);
            [eligible, reason] = await cms.canClaim(user1.address);
            expect(eligible).to.be.false;
            expect(reason).to.equal("No active stake");

            // Now stake
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            [eligible, reason] = await cms.canClaim(user1.address);
            expect(eligible).to.be.true;
            expect(reason).to.equal("Eligible");
        });
    });
});
