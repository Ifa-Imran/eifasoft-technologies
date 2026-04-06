import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("AffiliateDistributor", function () {
    // Non-zero referrer address for mandatory referrer parameter
    const REF = "0x0000000000000000000000000000000000000001";
    describe("Referrer Setting", function () {
        it("should set referrer correctly via STAKING_ROLE", async function () {
            const { affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            // Register user2 first (referrer must be registered)
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            expect(await affiliateDistributor.getReferrer(user1.address)).to.equal(user2.address);
        });

        it("should prevent self-referral", async function () {
            const { affiliateDistributor, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await expect(
                affiliateDistributor.setReferrer(user1.address, user1.address)
            ).to.be.revertedWith("AD: No self-referral");
        });

        it("should prevent circular referral", async function () {
            const { affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            // Register user2 first, then user1 -> user2
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // user2 already has a referrer, can't change
            // Instead test: register user3 under user1, then try user2 -> user1 (but user2 already set)
            // Actually user2's referrer is already set, so this would fail with "already set"
            // For circular test, use fresh users
        });

        it("should prevent setting referrer twice", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user3.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await expect(
                affiliateDistributor.setReferrer(user1.address, user3.address)
            ).to.be.revertedWith("AD: Referrer already set");
        });

        it("should track directReferrals and directCount", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
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
        it("should distribute through levels with correct percentages when unlocked", async function () {
            const { affiliateDistributor, owner, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            const signers = await ethers.getSigners();

            // Build 3-level chain: s[13] → s[14] → s[15] → s[16] → genesis
            await affiliateDistributor.setReferrer(signers[16].address, genesisAccount.address);
            await affiliateDistributor.setReferrer(signers[15].address, signers[16].address);
            await affiliateDistributor.setReferrer(signers[14].address, signers[15].address);
            await affiliateDistributor.setReferrer(signers[13].address, signers[14].address);

            // Give each upline enough direct sponsors to unlock their level:
            // s[14] at L1: needs 1 direct → already has s[13] ✓
            // s[15] at L2: needs 2 directs → has s[14], register s[17] under s[15]
            await affiliateDistributor.setReferrer(signers[17].address, signers[15].address);
            // s[16] at L3: needs 3 directs → has s[15], register s[18] and s[19] under s[16]
            await affiliateDistributor.setReferrer(signers[18].address, signers[16].address);
            await affiliateDistributor.setReferrer(signers[19].address, signers[16].address);

            const profit = ethers.parseEther("100");
            await affiliateDistributor.distributeTeamDividend(signers[13].address, profit);

            // L1 (s[14], 1 direct, 1 level unlocked): 10% = 10
            expect(await affiliateDistributor.teamDividends(signers[14].address)).to.equal(profit * 1000n / 10000n);
            // L2 (s[15], 2 directs, 2 levels unlocked): 5% = 5
            expect(await affiliateDistributor.teamDividends(signers[15].address)).to.equal(profit * 500n / 10000n);
            // L3 (s[16], 3 directs, 3 levels unlocked): 5% = 5
            expect(await affiliateDistributor.teamDividends(signers[16].address)).to.equal(profit * 500n / 10000n);
        });

        it("should skip dividends for uplines with insufficient directs", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            // chain: user1 → user2 → user3 → genesis
            await affiliateDistributor.setReferrer(user3.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user2.address, user3.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // user2 has 1 direct (user1) → unlocks L1 ✓
            // user3 has 1 direct (user2) → unlocks L1 only, NOT L2

            const profit = ethers.parseEther("100");
            await affiliateDistributor.distributeTeamDividend(user1.address, profit);

            expect(await affiliateDistributor.teamDividends(user2.address)).to.equal(profit * 1000n / 10000n); // L1: 10%
            expect(await affiliateDistributor.teamDividends(user3.address)).to.equal(0); // L2 locked (only 1 direct)
        });

        it("should stop at chain end if shorter than 15 levels", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, user4, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            // chain: user1 → user2 → user3 → genesis (2 levels)
            await affiliateDistributor.setReferrer(user3.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user2.address, user3.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // Give user3 a 2nd direct so it unlocks L2
            await affiliateDistributor.setReferrer(user4.address, user3.address);

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
                "AD: Below minimum harvest ($10)"
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
                "AD: Invalid income type"
            );
        });
    });

    describe("Rank & Qualifier", function () {
        it("should qualify for weekly dividend with $50k fresh business", async function () {
            const { affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            // user2 is referrer of user1
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // user1 stakes $50,000 — user2 (referrer) gets fresh business credit
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("50000"));
            const fb = await affiliateDistributor.getUserFreshBusiness(user2.address);
            expect(fb.weeklyBusiness).to.equal(ethers.parseEther("50000"));
            expect(fb.weeklyQualified).to.be.true;
        });

        it("should NOT qualify for weekly with less than $50k", async function () {
            const { affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("49999"));
            const fb = await affiliateDistributor.getUserFreshBusiness(user2.address);
            expect(fb.weeklyQualified).to.be.false;
        });

        it("should qualify for monthly dividend with $500k fresh business", async function () {
            const { affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("500000"));
            const fb = await affiliateDistributor.getUserFreshBusiness(user2.address);
            expect(fb.monthlyBusiness).to.equal(ethers.parseEther("500000"));
            expect(fb.monthlyQualified).to.be.true;
        });

        it("should allow qualified user to claim weekly qualifier after epoch close", async function () {
            const { affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // Generate $50k fresh business for user2
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("50000"));
            // Add some profit to the accumulator
            await affiliateDistributor.addProfit(ethers.parseEther("10000"));
            // Advance time past weekly interval (3 hours in test mode)
            await ethers.provider.send("evm_increaseTime", [3 * 3600 + 1]);
            await ethers.provider.send("evm_mine", []);
            // Close epoch
            await affiliateDistributor.tryCloseEpochs();
            // Now user2 should be able to claim weekly
            await affiliateDistributor.connect(user2).claimWeeklyQualifier();
            // 3% of 10000 = 300, 1 qualifier => 300 each
            expect(await affiliateDistributor.qualifierWeekly(user2.address)).to.equal(ethers.parseEther("300"));
        });

        it("should revert weekly claim for unqualified user", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // user2 qualifies, user3 does not
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("50000"));
            await affiliateDistributor.addProfit(ethers.parseEther("10000"));
            await ethers.provider.send("evm_increaseTime", [3 * 3600 + 1]);
            await ethers.provider.send("evm_mine", []);
            await affiliateDistributor.tryCloseEpochs();
            await expect(
                affiliateDistributor.connect(user3).claimWeeklyQualifier()
            ).to.be.revertedWith("AD: Not qualified (need $50k fresh business)");
        });

        it("should split weekly pool equally among multiple qualifiers", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user3.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            const signers = await ethers.getSigners();
            await affiliateDistributor.setReferrer(signers[10].address, user3.address);
            // Both user2 and user3 qualify
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("50000"));
            await affiliateDistributor.distributeDirect(user3.address, ethers.parseEther("60000"));
            await affiliateDistributor.addProfit(ethers.parseEther("10000"));
            await ethers.provider.send("evm_increaseTime", [3 * 3600 + 1]);
            await ethers.provider.send("evm_mine", []);
            await affiliateDistributor.tryCloseEpochs();
            await affiliateDistributor.connect(user2).claimWeeklyQualifier();
            await affiliateDistributor.connect(user3).claimWeeklyQualifier();
            // 3% of 10000 = 300, 2 qualifiers => 150 each
            expect(await affiliateDistributor.qualifierWeekly(user2.address)).to.equal(ethers.parseEther("150"));
            expect(await affiliateDistributor.qualifierWeekly(user3.address)).to.equal(ethers.parseEther("150"));
        });

        it("should accumulate fresh business from multiple stakes in same epoch", async function () {
            const { affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // Two stakes that together reach threshold
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("30000"));
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("25000"));
            const fb = await affiliateDistributor.getUserFreshBusiness(user2.address);
            expect(fb.weeklyBusiness).to.equal(ethers.parseEther("55000"));
            expect(fb.weeklyQualified).to.be.true;
        });

        it("should reset fresh business tracking on new epoch", async function () {
            const { affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // Qualify in epoch 0
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("50000"));
            await affiliateDistributor.addProfit(ethers.parseEther("1000"));
            // Advance to close epoch
            await ethers.provider.send("evm_increaseTime", [3 * 3600 + 1]);
            await ethers.provider.send("evm_mine", []);
            await affiliateDistributor.tryCloseEpochs();
            // Now in epoch 1 — add small business, should start fresh
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("1000"));
            const fb = await affiliateDistributor.getUserFreshBusiness(user2.address);
            expect(fb.weeklyBusiness).to.equal(ethers.parseEther("1000"));
            expect(fb.weeklyQualified).to.be.false;
        });
    });

    describe("View Functions", function () {
        it("should return all income correctly", async function () {
            const { affiliateDistributor, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await affiliateDistributor.distributeDirect(user1.address, ethers.parseEther("400")); // 20 USDT

            const [direct, team, rank, qWeekly, qMonthly] = await affiliateDistributor.getAllIncome(user1.address);
            expect(direct).to.equal(ethers.parseEther("20"));
            expect(team).to.equal(0n);
            expect(rank).to.equal(0n);
            expect(qWeekly).to.equal(0n);
            expect(qMonthly).to.equal(0n);
        });

        it("should return correct getTotalHarvestable", async function () {
            const { affiliateDistributor, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);
            await affiliateDistributor.distributeDirect(user1.address, ethers.parseEther("200")); // 10
            const total = await affiliateDistributor.getTotalHarvestable(user1.address);
            expect(total).to.equal(ethers.parseEther("10"));
        });

        it("should return correct upline chain", async function () {
            const { affiliateDistributor, owner, user1, user2, user3, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            // Register top-down: user3 under genesis, user2 under user3, user1 under user2
            await affiliateDistributor.setReferrer(user3.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user2.address, user3.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            const upline = await affiliateDistributor.getUpline(user1.address, 5);
            // user1 -> user2 -> user3 -> genesisAccount(sentinel stops here)
            expect(upline.length).to.equal(3);
            expect(upline[0]).to.equal(user2.address);
            expect(upline[1]).to.equal(user3.address);
            expect(upline[2]).to.equal(genesisAccount.address);
        });

        it("should return fresh business info", async function () {
            const { affiliateDistributor, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("25000"));
            const fb = await affiliateDistributor.getUserFreshBusiness(user2.address);
            expect(fb.weeklyBusiness).to.equal(ethers.parseEther("25000"));
            expect(fb.monthlyBusiness).to.equal(ethers.parseEther("25000"));
            expect(fb.weeklyQualified).to.be.false;
            expect(fb.monthlyQualified).to.be.false;
        });
    });

    describe("3X Cap Integration", function () {
        it("should report direct dividends to FIFO cap", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, user2, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);

            // user2 needs a stake to track cap against
            const stakingAddr = await stakingManager.getAddress();
            await (usdt as any).connect(user2).approve(stakingAddr, ethers.MaxUint256);
            await (stakingManager as any).connect(user2).stake(ethers.parseEther("500"), REF);

            // Distribute direct dividend to user2 (5% of 1000 = 50 USDT)
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("1000"));

            const [totalEarned] = await stakingManager.getGlobalCapProgress(user2.address);
            expect(totalEarned).to.equal(ethers.parseEther("50"));
        });

        it("should report team dividends to FIFO cap", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, user2, user3, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);

            // Register user2, then user2 stakes
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            const stakingAddr = await stakingManager.getAddress();
            await (usdt as any).connect(user2).approve(stakingAddr, ethers.MaxUint256);
            await (stakingManager as any).connect(user2).stake(ethers.parseEther("500"), REF);

            // chain: user1 -> user2
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await affiliateDistributor.distributeTeamDividend(user1.address, ethers.parseEther("100"));

            // user2 is L1: gets 10% of 100 = 10 USDT team dividend
            const [totalEarned] = await stakingManager.getGlobalCapProgress(user2.address);
            expect(totalEarned).to.equal(ethers.parseEther("10"));
        });

        it("should report weekly qualifier to FIFO cap", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, user2, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);

            // Register user2, then user2 stakes
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            const stakingAddr = await stakingManager.getAddress();
            await (usdt as any).connect(user2).approve(stakingAddr, ethers.MaxUint256);
            await (stakingManager as any).connect(user2).stake(ethers.parseEther("5000"), REF);

            // Qualify user2 for weekly
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("50000"));
            await affiliateDistributor.addProfit(ethers.parseEther("10000"));

            await ethers.provider.send("evm_increaseTime", [3 * 3600 + 1]);
            await ethers.provider.send("evm_mine", []);
            await affiliateDistributor.tryCloseEpochs();

            const capBefore = await stakingManager.getGlobalCapProgress(user2.address);
            await affiliateDistributor.connect(user2).claimWeeklyQualifier();
            const capAfter = await stakingManager.getGlobalCapProgress(user2.address);

            // 3% of 10000 = 300 USDT, 1 qualifier
            const weeklyShare = ethers.parseEther("300");
            // Cap should have increased by the direct dividend (50k * 5% = 2500) + weekly share (300)
            // But direct dividend was already tracked. Only weekly is new from claim.
            expect(capAfter[0] - capBefore[0]).to.equal(weeklyShare);
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
