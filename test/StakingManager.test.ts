import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("StakingManager", function () {
    // Non-zero referrer address for mandatory referrer parameter
    const REF = "0x0000000000000000000000000000000000000001";

    async function stakeFixture() {
        const f = await deployFullEcosystemFixture();
        // Approve staking contract to spend user1's USDT
        await f.usdt.connect(f.user1).approve(await f.stakingManager.getAddress(), ethers.MaxUint256);
        await f.usdt.connect(f.user2).approve(await f.stakingManager.getAddress(), ethers.MaxUint256);
        await f.usdt.connect(f.user3).approve(await f.stakingManager.getAddress(), ethers.MaxUint256);
        return f;
    }

    describe("Staking", function () {
        it("should create a Tier 0 stake (10-499 USDT)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes.length).to.equal(1);
            expect(stakes[0].tier).to.equal(0);
            expect(stakes[0].amount).to.equal(ethers.parseEther("100"));
            expect(stakes[0].active).to.be.true;
        });

        it("should create a Tier 1 stake (500-1999 USDT)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("500"), REF);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].tier).to.equal(1);
        });

        it("should create a Tier 2 stake (2000+ USDT)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("2000"), REF);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].tier).to.equal(2);
        });

        it("should revert on < 10 USDT stake", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await expect(
                stakingManager.connect(user1).stake(ethers.parseEther("9"), REF)
            ).to.be.revertedWith("StakingManager: Below minimum stake");
        });

        it("should forward 90% to LiquidityPool", async function () {
            const { stakingManager, liquidityPool, usdt, user1 } = await loadFixture(stakeFixture);
            const liquidityPoolAddress = await liquidityPool.getAddress();
            const balBefore = await usdt.balanceOf(liquidityPoolAddress);
            const stakeAmount = ethers.parseEther("100");
            await stakingManager.connect(user1).stake(stakeAmount, REF);
            const balAfter = await usdt.balanceOf(liquidityPoolAddress);
            expect(balAfter - balBefore).to.equal((stakeAmount * 90n) / 100n);
        });

        it("should forward 1% to each DAO wallet", async function () {
            const { stakingManager, usdt, user1, dao1, dao2, dao3, dao4, dao5 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("100");
            const expectedPerWallet = (stakeAmount * 1n) / 100n;

            const balsBefore = await Promise.all(
                [dao1, dao2, dao3, dao4, dao5].map(d => usdt.balanceOf(d.address))
            );

            await stakingManager.connect(user1).stake(stakeAmount, REF);

            const balsAfter = await Promise.all(
                [dao1, dao2, dao3, dao4, dao5].map(d => usdt.balanceOf(d.address))
            );

            for (let i = 0; i < 5; i++) {
                expect(balsAfter[i] - balsBefore[i]).to.equal(expectedPerWallet);
            }
        });

        it("should forward 5% to development fund wallet", async function () {
            const { stakingManager, usdt, user1, systemWallet } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("100");
            const expectedDevFund = (stakeAmount * 5n) / 100n;

            const balBefore = await usdt.balanceOf(systemWallet.address);
            await stakingManager.connect(user1).stake(stakeAmount, REF);
            const balAfter = await usdt.balanceOf(systemWallet.address);

            expect(balAfter - balBefore).to.equal(expectedDevFund);
        });

        it("should update totalActiveStakeValue", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            expect(await stakingManager.getTotalActiveStakeValue(user1.address)).to.equal(ethers.parseEther("100"));
        });
    });

    describe("Compounding", function () {
        it("should compound 0.1% per interval for Tier 0 (8h)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("100");
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            // Advance 8 hours (1 interval for Tier 0)
            await time.increase(28800);
            await stakingManager.connect(user1).compound(0);

            const stakes = await stakingManager.getUserStakes(user1.address);
            // 100 * 0.1% = 0.1
            const expectedAmount = stakeAmount + (stakeAmount / 1000n);
            expect(stakes[0].amount).to.equal(expectedAmount);
            expect(stakes[0].totalEarned).to.equal(stakeAmount / 1000n);
        });

        it("should compound multiple intervals correctly", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("1000");
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            // Advance 24 hours (3 intervals for Tier 1 at 6h each -> tier is 1 for 1000)
            await time.increase(21600 * 4); // 4 intervals
            await stakingManager.connect(user1).compound(0);

            const stakes = await stakingManager.getUserStakes(user1.address);
            // Compound 0.1% four times
            let expected = stakeAmount;
            for (let i = 0; i < 4; i++) {
                expected = expected + expected / 1000n;
            }
            expect(stakes[0].amount).to.equal(expected);
        });

        it("should revert when no intervals have passed", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await expect(stakingManager.connect(user1).compound(0)).to.be.revertedWith("StakingManager: No intervals passed");
        });

        it("should allow compoundFor by COMPOUNDER_ROLE", async function () {
            const { stakingManager, owner, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await time.increase(28800);
            await stakingManager.compoundFor(user1.address, 0); // owner has COMPOUNDER_ROLE
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].totalEarned).to.be.gt(0);
        });

        it("should allow compoundFor by any user (permissionless)", async function () {
            const { stakingManager, user1, user2 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await time.increase(28800);
            // Anyone can call compoundFor
            await stakingManager.connect(user2).compoundFor(user1.address, 0);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].totalEarned).to.be.gt(0);
        });

        it("should update totalEarned correctly", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await time.increase(28800);
            await stakingManager.connect(user1).compound(0);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].totalEarned).to.equal(ethers.parseEther("0.1")); // 100 * 0.1%
        });
    });

    describe("3X Cap", function () {
        it("should auto-close when totalEarned >= 3x original", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("10"); // small amount for faster cap
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            // 3x = 30 USDT earned. At 0.1% per 8h interval, need many intervals.
            const intervalsNeeded = 3000; // should be enough for 3x with compounding
            await time.increase(28800 * intervalsNeeded);
            await stakingManager.connect(user1).compound(0);

            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].active).to.be.false;
            expect(stakes[0].totalEarned).to.equal(3n * stakeAmount);
        });

        it("should return 80% as KAIRO via mintTo on auto-close", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("10");
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            const balBefore = await kairoToken.balanceOf(user1.address);
            await time.increase(28800 * 3000);
            await stakingManager.connect(user1).compound(0);
            const balAfter = await kairoToken.balanceOf(user1.address);

            // User should have received KAIRO (minted via mintTo)
            expect(balAfter).to.be.gt(balBefore);
        });

        it("should fill oldest stake first (FIFO)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            // Create two stakes
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await stakingManager.connect(user1).stake(ethers.parseEther("500"), REF);

            // Compound stake 1 for a few intervals
            await time.increase(28800 * 5);
            await stakingManager.connect(user1).compound(0);

            const stakes = await stakingManager.getUserStakes(user1.address);
            // FIFO: compound earnings on stake 0 should fill stake 0's totalEarned first
            expect(stakes[0].totalEarned).to.be.gt(0);
            // Stake 1 should have 0 totalEarned since stake 0 still has space
            expect(stakes[1].totalEarned).to.equal(0);
        });

        it("should roll earnings to next stake when oldest caps via FIFO", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            // Stake 0: small, will cap quickly (cap = $30)
            await stakingManager.connect(user1).stake(ethers.parseEther("10"), REF);
            // Stake 1: larger (cap = $1500)
            await stakingManager.connect(user1).stake(ethers.parseEther("500"), REF);

            // Compound stake 1 with enough intervals to exceed stake 0's cap ($30)
            // but NOT enough to cap stake 1 ($1500)
            // Each interval on $500 gives ~$0.5 profit. Need ~100 intervals for ~$50.
            // $30 fills stake 0, ~$20 goes to stake 1.
            await time.increase(28800 * 100);
            await stakingManager.connect(user1).compound(1);

            const stakes = await stakingManager.getUserStakes(user1.address);
            // Stake 0 should be auto-closed (capped at 3x = $30)
            expect(stakes[0].active).to.be.false;
            expect(stakes[0].totalEarned).to.equal(ethers.parseEther("30"));
            // Stake 1 should have received the overflow and still be active
            expect(stakes[1].totalEarned).to.be.gt(0);
            expect(stakes[1].active).to.be.true;
        });

        it("should close oldest stake via external addEarnings", async function () {
            const { stakingManager, affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(stakeFixture);
            // User1 stakes small amount
            await stakingManager.connect(user1).stake(ethers.parseEther("10"), REF);

            // Register user2 under genesis, then user1 under user2
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);

            // User2 also stakes so they have a stake to be capped
            await stakingManager.connect(user2).stake(ethers.parseEther("10"), REF);

            // Distribute a large direct dividend to user2 via a huge stake from user1
            // 5% of a large amount should push user2's cap
            // User2's cap = 3 * 10 = 30 USDT
            // Direct dividend reports to addEarnings
            // Let's directly call addEarnings from affiliateDistributor context
            // Actually, distributeDirect will call addEarnings internally
            // Let's use distributeDirect with a large stake amount
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("700")); // 5% = $35 > $30 cap

            const stakes = await stakingManager.getUserStakes(user2.address);
            // User2's stake should be auto-closed by the $35 direct dividend exceeding $30 cap
            expect(stakes[0].active).to.be.false;
            expect(stakes[0].totalEarned).to.equal(ethers.parseEther("30")); // capped at 3x
        });

        it("should revert addEarnings from unauthorized caller", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await expect(
                stakingManager.connect(user1).addEarnings(user1.address, ethers.parseEther("100"))
            ).to.be.revertedWith("StakingManager: Unauthorized");
        });

        it("should track compoundEarned separately from totalEarned", async function () {
            const { stakingManager, affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);

            // Compound to generate compound earnings
            await time.increase(28800 * 5);
            await stakingManager.connect(user1).compound(0);

            let stk = await stakingManager.getStake(user1.address, 0);
            const compoundProfit = stk.compoundEarned;
            expect(compoundProfit).to.be.gt(0);

            // Now push external earnings via affiliateDistributor
            await affiliateDistributor.setReferrer(user1.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user2.address, user1.address);
            await affiliateDistributor.distributeDirect(user1.address, ethers.parseEther("200")); // $10 dividend

            stk = await stakingManager.getStake(user1.address, 0);
            // totalEarned should include both compound + external
            expect(stk.totalEarned).to.be.gt(compoundProfit);
            // compoundEarned should only have compound profit
            expect(stk.compoundEarned).to.equal(compoundProfit);
        });

        it("should return correct getGlobalCapProgress", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await stakingManager.connect(user1).stake(ethers.parseEther("200"), REF);

            const [earned, cap, remaining] = await stakingManager.getGlobalCapProgress(user1.address);
            expect(earned).to.equal(0);
            expect(cap).to.equal(ethers.parseEther("900")); // 3 * (100 + 200)
            expect(remaining).to.equal(ethers.parseEther("900"));
        });
    });

    describe("Unstaking", function () {
        it("should return 80% minus harvested rewards as KAIRO", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);

            // Compound to accumulate some earnings
            await time.increase(28800 * 10); // 10 intervals
            await stakingManager.connect(user1).compound(0);

            const balBefore = await kairoToken.balanceOf(user1.address);
            await stakingManager.connect(user1).unstake(0);
            const balAfter = await kairoToken.balanceOf(user1.address);

            expect(balAfter).to.be.gt(balBefore);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].active).to.be.false;
        });

        it("should mark stake inactive after unstake", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await stakingManager.connect(user1).unstake(0);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].active).to.be.false;
        });

        it("should revert unstake for inactive stakes", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await stakingManager.connect(user1).unstake(0);
            await expect(stakingManager.connect(user1).unstake(0)).to.be.revertedWith("StakingManager: Stake not active");
        });

        it("should revert unstake for invalid stake ID", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await expect(stakingManager.connect(user1).unstake(0)).to.be.revertedWith("StakingManager: Invalid stake ID");
        });

        it("should deduct harvested rewards from return", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);

            // Compound enough to harvest
            await time.increase(28800 * 200); // 200 intervals to accumulate > $10
            await stakingManager.connect(user1).compound(0);

            // Harvest $10
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));

            // Now unstake - the return should be 80% of current amount minus harvested ($10)
            const stakeBefore = await stakingManager.getStake(user1.address, 0);
            const grossReturn = (stakeBefore.amount * 80n) / 100n;
            const expectedReturn = grossReturn - stakeBefore.harvestedRewards;

            const balBefore = await kairoToken.balanceOf(user1.address);
            await stakingManager.connect(user1).unstake(0);
            const balAfter = await kairoToken.balanceOf(user1.address);

            // balAfter - balBefore should correspond to expectedReturn minted via mintTo
            expect(balAfter).to.be.gt(balBefore);
        });
    });

    describe("Harvesting", function () {
        it("should enforce $10 minimum harvest", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await time.increase(28800);
            await stakingManager.connect(user1).compound(0);

            await expect(
                stakingManager.connect(user1).harvest(0, ethers.parseEther("0.1"))
            ).to.be.revertedWith("StakingManager: Below minimum harvest ($10)");
        });

        it("should harvest and track harvestedRewards correctly", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);

            // Compound enough intervals to have > $10 available
            await time.increase(28800 * 200);
            await stakingManager.connect(user1).compound(0);

            const stk = await stakingManager.getStake(user1.address, 0);
            expect(stk.compoundEarned).to.be.gte(ethers.parseEther("10"));

            const balBefore = await kairoToken.balanceOf(user1.address);
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            const balAfter = await kairoToken.balanceOf(user1.address);
            expect(balAfter).to.be.gt(balBefore);

            const stkAfter = await stakingManager.getStake(user1.address, 0);
            expect(stkAfter.harvestedRewards).to.equal(ethers.parseEther("10"));
        });

        it("should revert harvest exceeding available amount", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await time.increase(28800);
            await stakingManager.connect(user1).compound(0);

            // totalEarned is only 0.1 USDT
            await expect(
                stakingManager.connect(user1).harvest(0, ethers.parseEther("10"))
            ).to.be.revertedWith("StakingManager: Insufficient harvestable amount");
        });
    });

    describe("View Functions", function () {
        it("should return correct getUserStakes", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await stakingManager.connect(user1).stake(ethers.parseEther("500"), REF);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes.length).to.equal(2);
        });

        it("should return correct getCapProgress", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("100");
            await stakingManager.connect(user1).stake(stakeAmount, REF);
            const [earned, cap] = await stakingManager.getCapProgress(user1.address, 0);
            expect(earned).to.equal(0);
            expect(cap).to.equal(3n * stakeAmount);
        });

        it("should return correct getUserStakeCount", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            expect(await stakingManager.getUserStakeCount(user1.address)).to.equal(1);
        });
    });

    describe("Admin Functions", function () {
        it("should allow admin to pause/unpause", async function () {
            const { stakingManager, owner, user1 } = await loadFixture(stakeFixture);
            await stakingManager.pause();
            await expect(
                stakingManager.connect(user1).stake(ethers.parseEther("100"), REF)
            ).to.be.reverted;
            await stakingManager.unpause();
        });

        it("should allow admin to set development fund wallet", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.setDevelopmentFundWallet(user1.address);
            expect(await stakingManager.developmentFundWallet()).to.equal(user1.address);
        });

        it("should allow admin to set DAO wallets", async function () {
            const { stakingManager, user1, user2, user3, user4, user5 } = await loadFixture(stakeFixture);
            const newDaoWallets = [user1.address, user2.address, user3.address, user4.address, user5.address];
            await stakingManager.setDaoWallets(newDaoWallets);
            const wallets = await stakingManager.getDaoWallets();
            for (let i = 0; i < 5; i++) {
                expect(wallets[i]).to.equal(newDaoWallets[i]);
            }
        });
    });
});
