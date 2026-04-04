import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("AffiliateDistributor", function () {
    describe("Referrer Setting", function () {
        it("should set referrer correctly via STAKING_ROLE", async function () {
            const { affiliateDistributor, stakingManager, user1, user2 } = await loadFixture(deployFullEcosystemFixture);
            // StakingManager has STAKING_ROLE, so call from staking context
            // We'll use the owner who has STAKING_ROLE via grantRole or we call via staking
            // Actually, let's call setReferrer directly via a contract that has STAKING_ROLE
            // The stakingManager itself calls distributeDirect which doesn't set referrer.
            // Let's grant STAKING_ROLE to owner for testing
            const { owner, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            expect(await affiliateDistributor.getReferrer(user1.address)).to.equal(user2.address);
        });

        it("should prevent self-referral", async function () {
            const { affiliateDistributor, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await expect(
                affiliateDistributor.setReferrer(user1.address, user1.address)
            ).to.be.revertedWith("AffiliateDistributor: No self-referral");
        });

        it("should prevent circular referral", async function () {
            const { affiliateDistributor, owner, user1, user2, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            // user1 -> user2
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // user2 -> user1 should fail (circular)
            await expect(
                affiliateDistributor.setReferrer(user2.address, user1.address)
            ).to.be.revertedWith("AffiliateDistributor: Circular referral detected");
        });

        it("should prevent setting referrer twice", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await expect(
                affiliateDistributor.setReferrer(user1.address, user3.address)
            ).to.be.revertedWith("AffiliateDistributor: Referrer already set");
        });

        it("should track directReferrals and directCount", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await affiliateDistributor.setReferrer(user3.address, user2.address);
            const referrals = await affiliateDistributor.getDirectReferrals(user2.address);
            expect(referrals.length).to.equal(2);
            expect(await affiliateDistributor.directCount(user2.address)).to.equal(2);
        });
    });

    describe("Direct Dividends", function () {
        it("should calculate 5% direct dividend", async function () {
            const { affiliateDistributor, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            const stakeAmount = ethers.parseEther("1000");
            await affiliateDistributor.distributeDirect(user1.address, stakeAmount);
            expect(await affiliateDistributor.directDividends(user1.address)).to.equal(stakeAmount * 5n / 100n);
        });

        it("should revert distributeDirect from non-STAKING_ROLE", async function () {
            const { affiliateDistributor, user1, user2 } = await loadFixture(deployFullEcosystemFixture);
            await expect(
                affiliateDistributor.connect(user1).distributeDirect(user2.address, ethers.parseEther("100"))
            ).to.be.reverted;
        });
    });

    describe("Team Dividends", function () {
        it("should distribute through 15 levels with correct percentages", async function () {
            const { affiliateDistributor, owner, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            const signers = await ethers.getSigners();
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);

            // Build chain: signer[2] -> signer[3] -> ... -> signer[17] (15 levels above signer[2])
            // Set referrals: signer[2]'s referrer is signer[3], signer[3]'s referrer is signer[4], etc.
            for (let i = 2; i < 17; i++) {
                await affiliateDistributor.setReferrer(signers[i].address, signers[i + 1].address);
            }

            const profit = ethers.parseEther("100");
            await affiliateDistributor.distributeTeamDividend(signers[2].address, profit);

            // L1 (signer[3]): 10% = 10
            expect(await affiliateDistributor.teamDividends(signers[3].address)).to.equal(profit * 1000n / 10000n);
            // L2 (signer[4]): 5% = 5
            expect(await affiliateDistributor.teamDividends(signers[4].address)).to.equal(profit * 500n / 10000n);
            // L11 (signer[13]): 2% = 2
            expect(await affiliateDistributor.teamDividends(signers[13].address)).to.equal(profit * 200n / 10000n);
        });

        it("should stop at chain end if shorter than 15 levels", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            // chain: user1 -> user2 -> user3 (2 levels only)
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await affiliateDistributor.setReferrer(user2.address, user3.address);

            const profit = ethers.parseEther("100");
            await affiliateDistributor.distributeTeamDividend(user1.address, profit);

            expect(await affiliateDistributor.teamDividends(user2.address)).to.equal(profit * 1000n / 10000n); // L1: 10%
            expect(await affiliateDistributor.teamDividends(user3.address)).to.equal(profit * 500n / 10000n); // L2: 5%
        });
    });

    describe("Harvesting", function () {
        it("should enforce $10 minimum harvest", async function () {
            const { affiliateDistributor, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await affiliateDistributor.distributeDirect(user1.address, ethers.parseEther("100")); // 5 USDT dividend
            // 5 USDT < 10 USDT minimum
            await expect(affiliateDistributor.connect(user1).harvest(0)).to.be.revertedWith(
                "AffiliateDistributor: Below minimum harvest ($10)"
            );
        });

        it("should harvest direct dividends and mint KAIRO", async function () {
            const { affiliateDistributor, kairoToken, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            // 200 USDT stake => 10 USDT dividend (5%)
            await affiliateDistributor.distributeDirect(user1.address, ethers.parseEther("200"));
            expect(await affiliateDistributor.directDividends(user1.address)).to.equal(ethers.parseEther("10"));

            const balBefore = await kairoToken.balanceOf(user1.address);
            await affiliateDistributor.connect(user1).harvest(0); // income type 0 = direct
            const balAfter = await kairoToken.balanceOf(user1.address);
            expect(balAfter).to.be.gt(balBefore);
            // Direct dividends should be zeroed
            expect(await affiliateDistributor.directDividends(user1.address)).to.equal(0);
        });

        it("should revert on invalid income type", async function () {
            const { affiliateDistributor, user1 } = await loadFixture(deployFullEcosystemFixture);
            await expect(affiliateDistributor.connect(user1).harvest(5)).to.be.revertedWith(
                "AffiliateDistributor: Invalid income type"
            );
        });
    });

    describe("Rank & Qualifier", function () {
        it("should update rank dividend via RANK_UPDATER_ROLE", async function () {
            const { affiliateDistributor, owner, user1 } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.updateRankDividend(user1.address, ethers.parseEther("50"));
            expect(await affiliateDistributor.rankDividends(user1.address)).to.equal(ethers.parseEther("50"));
        });

        it("should batch update weekly qualifiers", async function () {
            const { affiliateDistributor, user1, user2 } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.updateQualifierWeekly(
                [user1.address, user2.address],
                [ethers.parseEther("20"), ethers.parseEther("30")]
            );
            expect(await affiliateDistributor.qualifierWeekly(user1.address)).to.equal(ethers.parseEther("20"));
            expect(await affiliateDistributor.qualifierWeekly(user2.address)).to.equal(ethers.parseEther("30"));
        });

        it("should batch update monthly qualifiers", async function () {
            const { affiliateDistributor, user1, user2 } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.updateQualifierMonthly(
                [user1.address, user2.address],
                [ethers.parseEther("15"), ethers.parseEther("25")]
            );
            expect(await affiliateDistributor.qualifierMonthly(user1.address)).to.equal(ethers.parseEther("15"));
            expect(await affiliateDistributor.qualifierMonthly(user2.address)).to.equal(ethers.parseEther("25"));
        });

        it("should revert batch update with mismatched lengths", async function () {
            const { affiliateDistributor, user1 } = await loadFixture(deployFullEcosystemFixture);
            await expect(
                affiliateDistributor.updateQualifierWeekly(
                    [user1.address],
                    [ethers.parseEther("20"), ethers.parseEther("30")]
                )
            ).to.be.revertedWith("AffiliateDistributor: Length mismatch");
        });
    });

    describe("View Functions", function () {
        it("should return all income correctly", async function () {
            const { affiliateDistributor, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await affiliateDistributor.distributeDirect(user1.address, ethers.parseEther("400")); // 20 USDT
            await affiliateDistributor.updateRankDividend(user1.address, ethers.parseEther("15"));
            await affiliateDistributor.updateQualifierWeekly([user1.address], [ethers.parseEther("12")]);
            await affiliateDistributor.updateQualifierMonthly([user1.address], [ethers.parseEther("8")]);

            const [direct, team, rank, qWeekly, qMonthly] = await affiliateDistributor.getAllIncome(user1.address);
            expect(direct).to.equal(ethers.parseEther("20"));
            expect(rank).to.equal(ethers.parseEther("15"));
            expect(qWeekly).to.equal(ethers.parseEther("12"));
            expect(qMonthly).to.equal(ethers.parseEther("8"));
        });

        it("should return correct getTotalHarvestable", async function () {
            const { affiliateDistributor, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await affiliateDistributor.distributeDirect(user1.address, ethers.parseEther("200")); // 10
            await affiliateDistributor.updateRankDividend(user1.address, ethers.parseEther("5"));
            const total = await affiliateDistributor.getTotalHarvestable(user1.address);
            expect(total).to.equal(ethers.parseEther("15"));
        });

        it("should return correct upline chain", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await affiliateDistributor.setReferrer(user2.address, user3.address);
            const upline = await affiliateDistributor.getUpline(user1.address, 5);
            expect(upline.length).to.equal(2);
            expect(upline[0]).to.equal(user2.address);
            expect(upline[1]).to.equal(user3.address);
        });
    });

    describe("Admin Functions", function () {
        it("should allow admin to pause/unpause", async function () {
            const { affiliateDistributor, user1 } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.pause();
            await expect(affiliateDistributor.connect(user1).harvest(0)).to.be.reverted;
            await affiliateDistributor.unpause();
        });

        it("should allow admin to set system wallet", async function () {
            const { affiliateDistributor, user1 } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setSystemWallet(user1.address);
            expect(await affiliateDistributor.systemWallet()).to.equal(user1.address);
        });
    });
});
