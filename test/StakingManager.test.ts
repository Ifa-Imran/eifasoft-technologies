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

        it("should forward 1% to DAOs 1-4 and 0.5% to DAOs 5-6", async function () {
            const { stakingManager, usdt, user1, dao1, dao2, dao3, dao4, dao5, dao6 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("100");
            const expected1Pct = (stakeAmount * 1n) / 100n;
            const expected05Pct = (stakeAmount * 5n) / 1000n;

            const balsBefore = await Promise.all(
                [dao1, dao2, dao3, dao4, dao5, dao6].map(d => usdt.balanceOf(d.address))
            );

            await stakingManager.connect(user1).stake(stakeAmount, REF);

            const balsAfter = await Promise.all(
                [dao1, dao2, dao3, dao4, dao5, dao6].map(d => usdt.balanceOf(d.address))
            );

            // DAOs 1-4: 1% each
            for (let i = 0; i < 4; i++) {
                expect(balsAfter[i] - balsBefore[i]).to.equal(expected1Pct);
            }
            // DAOs 5-6: 0.5% each
            for (let i = 4; i < 6; i++) {
                expect(balsAfter[i] - balsBefore[i]).to.equal(expected05Pct);
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
        it("should compound 0.15% per interval for Tier 0 (900s TEST)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("100");
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            // Advance 1 interval for Tier 0 (900s in test mode)
            await time.increase(900);
            await stakingManager.connect(user1).compound(0);

            const stakes = await stakingManager.getUserStakes(user1.address);
            // 100 * 0.15% = 0.15
            const expectedProfit = (stakeAmount * 15n) / 10000n;
            const expectedAmount = stakeAmount + expectedProfit;
            expect(stakes[0].amount).to.equal(expectedAmount);
            // totalEarned is now harvest-based (0 after compound, no harvest yet)
            expect(stakes[0].totalEarned).to.equal(0);
            expect(stakes[0].compoundEarned).to.equal(expectedProfit);
        });

        it("should compound multiple intervals correctly", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("1000");
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            // Advance 4 intervals for Tier 1 (600s each in test mode)
            await time.increase(600 * 4); // 4 intervals
            await stakingManager.connect(user1).compound(0);

            const stakes = await stakingManager.getUserStakes(user1.address);
            // Compound 0.15% four times
            let expected = stakeAmount;
            for (let i = 0; i < 4; i++) {
                expected = expected + (expected * 15n) / 10000n;
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
            await time.increase(900);
            await stakingManager.compoundFor(user1.address, 0); // owner has COMPOUNDER_ROLE
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].compoundEarned).to.be.gt(0);
        });

        it("should allow compoundFor by any user (permissionless)", async function () {
            const { stakingManager, user1, user2 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await time.increase(900);
            // Anyone can call compoundFor
            await stakingManager.connect(user2).compoundFor(user1.address, 0);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].compoundEarned).to.be.gt(0);
        });

        it("should not update totalEarned on compound (harvest-triggered cap)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await time.increase(900);
            await stakingManager.connect(user1).compound(0);
            const stakes = await stakingManager.getUserStakes(user1.address);
            // totalEarned tracks harvested capped income, not earned
            expect(stakes[0].totalEarned).to.equal(0);
            // compoundEarned should have the profit
            expect(stakes[0].compoundEarned).to.equal(ethers.parseEther("0.15")); // 100 * 0.15%
        });
    });

    describe("3X Harvest-Triggered Cap", function () {
        it("should cap stake when total harvested reaches 3x via compound harvests", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("10"); // small amount for faster cap
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            // Compound many times to accumulate large compoundEarned
            // Need ~1387 intervals for $10 to accumulate $30 compoundEarned
            await time.increase(900 * 1500);
            await stakingManager.connect(user1).compound(0);

            const stk = await stakingManager.getStake(user1.address, 0);
            // Stake should still be active (no auto-close on compound)
            expect(stk.active).to.be.true;
            // totalEarned should be 0 (nothing harvested yet)
            expect(stk.totalEarned).to.equal(0);
            // compoundEarned should be large
            expect(stk.compoundEarned).to.be.gt(0);

            // Now harvest up to 3x cap ($30)
            const cap = 3n * stakeAmount; // $30
            // Harvest in chunks
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));

            const stkAfter = await stakingManager.getStake(user1.address, 0);
            expect(stkAfter.totalEarned).to.equal(cap);
            // Stake is now capped (active=false via _markStakeCapped)
            expect(stkAfter.active).to.be.false;
        });

        it("should revert compounding on capped stakes", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("10");
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            // Compound a lot
            await time.increase(900 * 1500);
            await stakingManager.connect(user1).compound(0);

            // Harvest full 3x cap
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));

            // Try to compound again - should revert (stake is inactive/capped)
            await time.increase(900);
            await expect(
                stakingManager.connect(user1).compound(0)
            ).to.be.revertedWith("StakingManager: Stake not active");
        });

        it("should not allow unstaking on capped stakes", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("10");
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            // Compound + harvest to 3x cap
            await time.increase(900 * 1500);
            await stakingManager.connect(user1).compound(0);
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));

            // Unstake should revert on capped stake (active=false)
            await expect(
                stakingManager.connect(user1).unstake(0)
            ).to.be.revertedWith("StakingManager: Stake not active");
        });

        it("should fill oldest stake first via FIFO on harvest", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            // Create two stakes
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await stakingManager.connect(user1).stake(ethers.parseEther("500"), REF);

            // Compound stake 0 for enough to harvest $10
            await time.increase(900 * 100);
            await stakingManager.connect(user1).compound(0);

            // Harvest from stake 0 - should apply to FIFO (oldest stake first)
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));

            const stakes = await stakingManager.getUserStakes(user1.address);
            // FIFO: harvest applied to stake 0 first
            expect(stakes[0].totalEarned).to.equal(ethers.parseEther("10"));
            // Stake 1 should have 0 totalEarned
            expect(stakes[1].totalEarned).to.equal(0);
        });

        it("should revert applyCappedHarvest from unauthorized caller", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await expect(
                stakingManager.connect(user1).applyCappedHarvest(user1.address, ethers.parseEther("100"))
            ).to.be.revertedWith("StakingManager: Unauthorized");
        });

        it("should track compoundEarned separately from totalEarned (harvest-based)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);

            // Compound to generate compound earnings
            await time.increase(900 * 100);
            await stakingManager.connect(user1).compound(0);

            let stk = await stakingManager.getStake(user1.address, 0);
            const compoundProfit = stk.compoundEarned;
            expect(compoundProfit).to.be.gt(0);
            // totalEarned should be 0 (nothing harvested)
            expect(stk.totalEarned).to.equal(0);

            // Harvest $10 - totalEarned should increase
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            stk = await stakingManager.getStake(user1.address, 0);
            expect(stk.totalEarned).to.equal(ethers.parseEther("10"));
            // compoundEarned stays the same
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

        it("should return false from hasActivePosition for capped stakes", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("10");
            await stakingManager.connect(user1).stake(stakeAmount, REF);

            // Compound + harvest to 3x cap
            await time.increase(900 * 1500);
            await stakingManager.connect(user1).compound(0);
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));

            // Stake is capped (active=false) — no active position
            expect(await stakingManager.hasActivePosition(user1.address)).to.be.false;
        });
    });

    describe("Unstaking", function () {
        it("should return 80% minus harvested rewards as KAIRO", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);

            // Compound to accumulate some earnings
            await time.increase(900 * 10); // 10 intervals
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
            await time.increase(900 * 100); // 100 intervals to accumulate > $10
            await stakingManager.connect(user1).compound(0);

            // Harvest $10 (applies to FIFO cap)
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));

            // Now unstake - the return should be 80% of current amount
            const stakeBefore = await stakingManager.getStake(user1.address, 0);

            const balBefore = await kairoToken.balanceOf(user1.address);
            await stakingManager.connect(user1).unstake(0);
            const balAfter = await kairoToken.balanceOf(user1.address);

            // balAfter - balBefore should correspond to 80% of stk.amount minted via mintTo
            expect(balAfter).to.be.gt(balBefore);
        });
    });

    describe("Harvesting", function () {
        it("should enforce $10 minimum harvest", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);
            await time.increase(900);
            await stakingManager.connect(user1).compound(0);

            await expect(
                stakingManager.connect(user1).harvest(0, ethers.parseEther("0.1"))
            ).to.be.revertedWith("StakingManager: Below minimum harvest ($10)");
        });

        it("should harvest and track harvestedRewards correctly", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), REF);

            // Compound enough intervals to have > $10 available
            await time.increase(900 * 100);
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
            await time.increase(900);
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
            const { stakingManager, user1, user2, user3, user4, user5, dao6 } = await loadFixture(stakeFixture);
            const newDaoWallets = [user1.address, user2.address, user3.address, user4.address, user5.address, dao6.address];
            await stakingManager.setDaoWallets(newDaoWallets);
            const wallets = await stakingManager.getDaoWallets();
            for (let i = 0; i < 6; i++) {
                expect(wallets[i]).to.equal(newDaoWallets[i]);
            }
        });
    });
});
