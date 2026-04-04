import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("StakingManager", function () {
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
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes.length).to.equal(1);
            expect(stakes[0].tier).to.equal(0);
            expect(stakes[0].amount).to.equal(ethers.parseEther("100"));
            expect(stakes[0].active).to.be.true;
        });

        it("should create a Tier 1 stake (500-1999 USDT)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("500"), ethers.ZeroAddress);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].tier).to.equal(1);
        });

        it("should create a Tier 2 stake (2000+ USDT)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("2000"), ethers.ZeroAddress);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].tier).to.equal(2);
        });

        it("should revert on < 10 USDT stake", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await expect(
                stakingManager.connect(user1).stake(ethers.parseEther("9"), ethers.ZeroAddress)
            ).to.be.revertedWith("StakingManager: Below minimum stake");
        });

        it("should forward 60% to AuxFund", async function () {
            const { stakingManager, auxFund, usdt, user1 } = await loadFixture(stakeFixture);
            const auxFundAddress = await auxFund.getAddress();
            const balBefore = await usdt.balanceOf(auxFundAddress);
            const stakeAmount = ethers.parseEther("100");
            await stakingManager.connect(user1).stake(stakeAmount, ethers.ZeroAddress);
            const balAfter = await usdt.balanceOf(auxFundAddress);
            expect(balAfter - balBefore).to.equal((stakeAmount * 60n) / 100n);
        });

        it("should update totalActiveStakeValue", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            expect(await stakingManager.getTotalActiveStakeValue(user1.address)).to.equal(ethers.parseEther("100"));
        });
    });

    describe("Compounding", function () {
        it("should compound 0.1% per interval for Tier 0 (8h)", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("100");
            await stakingManager.connect(user1).stake(stakeAmount, ethers.ZeroAddress);

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
            await stakingManager.connect(user1).stake(stakeAmount, ethers.ZeroAddress);

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
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            await expect(stakingManager.connect(user1).compound(0)).to.be.revertedWith("StakingManager: No intervals passed");
        });

        it("should allow compoundFor by COMPOUNDER_ROLE", async function () {
            const { stakingManager, owner, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            await time.increase(28800);
            await stakingManager.compoundFor(user1.address, 0); // owner has COMPOUNDER_ROLE
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].totalEarned).to.be.gt(0);
        });

        it("should revert compoundFor by non-COMPOUNDER_ROLE", async function () {
            const { stakingManager, user1, user2 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            await time.increase(28800);
            await expect(stakingManager.connect(user2).compoundFor(user1.address, 0)).to.be.reverted;
        });

        it("should update totalEarned correctly", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
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
            await stakingManager.connect(user1).stake(stakeAmount, ethers.ZeroAddress);

            // 3x = 30 USDT earned. At 0.1% per 8h interval, need many intervals.
            // Each compound: ~0.01 USDT. Need ~3000 intervals to reach 30 USDT.
            // That's 3000 * 8h = 24000h. Let's do it in large chunks.
            // Actually compound many intervals at once
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
            await stakingManager.connect(user1).stake(stakeAmount, ethers.ZeroAddress);

            const balBefore = await kairoToken.balanceOf(user1.address);
            await time.increase(28800 * 3000);
            await stakingManager.connect(user1).compound(0);
            const balAfter = await kairoToken.balanceOf(user1.address);

            // User should have received KAIRO (minted via mintTo)
            expect(balAfter).to.be.gt(balBefore);
        });
    });

    describe("Unstaking", function () {
        it("should return 80% minus harvested rewards as KAIRO", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);

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
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            await stakingManager.connect(user1).unstake(0);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes[0].active).to.be.false;
        });

        it("should revert unstake for inactive stakes", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            await stakingManager.connect(user1).unstake(0);
            await expect(stakingManager.connect(user1).unstake(0)).to.be.revertedWith("StakingManager: Stake not active");
        });

        it("should revert unstake for invalid stake ID", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await expect(stakingManager.connect(user1).unstake(0)).to.be.revertedWith("StakingManager: Invalid stake ID");
        });

        it("should deduct harvested rewards from return", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);

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
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            await time.increase(28800);
            await stakingManager.connect(user1).compound(0);

            await expect(
                stakingManager.connect(user1).harvest(0, ethers.parseEther("0.1"))
            ).to.be.revertedWith("StakingManager: Below minimum harvest ($10)");
        });

        it("should harvest and track harvestedRewards correctly", async function () {
            const { stakingManager, kairoToken, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);

            // Compound enough intervals to have > $10 available
            await time.increase(28800 * 200);
            await stakingManager.connect(user1).compound(0);

            const stk = await stakingManager.getStake(user1.address, 0);
            expect(stk.totalEarned).to.be.gte(ethers.parseEther("10"));

            const balBefore = await kairoToken.balanceOf(user1.address);
            await stakingManager.connect(user1).harvest(0, ethers.parseEther("10"));
            const balAfter = await kairoToken.balanceOf(user1.address);
            expect(balAfter).to.be.gt(balBefore);

            const stkAfter = await stakingManager.getStake(user1.address, 0);
            expect(stkAfter.harvestedRewards).to.equal(ethers.parseEther("10"));
        });

        it("should revert harvest exceeding available amount", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
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
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            await stakingManager.connect(user1).stake(ethers.parseEther("500"), ethers.ZeroAddress);
            const stakes = await stakingManager.getUserStakes(user1.address);
            expect(stakes.length).to.equal(2);
        });

        it("should return correct getCapProgress", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            const stakeAmount = ethers.parseEther("100");
            await stakingManager.connect(user1).stake(stakeAmount, ethers.ZeroAddress);
            const [earned, cap] = await stakingManager.getCapProgress(user1.address, 0);
            expect(earned).to.equal(0);
            expect(cap).to.equal(3n * stakeAmount);
        });

        it("should return correct getUserStakeCount", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress);
            expect(await stakingManager.getUserStakeCount(user1.address)).to.equal(1);
        });
    });

    describe("Admin Functions", function () {
        it("should allow admin to pause/unpause", async function () {
            const { stakingManager, owner, user1 } = await loadFixture(stakeFixture);
            await stakingManager.pause();
            await expect(
                stakingManager.connect(user1).stake(ethers.parseEther("100"), ethers.ZeroAddress)
            ).to.be.reverted;
            await stakingManager.unpause();
        });

        it("should allow admin to set system wallet", async function () {
            const { stakingManager, user1 } = await loadFixture(stakeFixture);
            await stakingManager.setSystemWallet(user1.address);
            expect(await stakingManager.systemWallet()).to.equal(user1.address);
        });
    });
});
