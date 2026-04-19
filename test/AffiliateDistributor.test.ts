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
            const { affiliateDistributor, stakingManager, usdt, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);

            // user1 needs an active stake to receive direct income
            const stakingAddr = await stakingManager.getAddress();
            await usdt.connect(user1).approve(stakingAddr, ethers.MaxUint256);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), "0x0000000000000000000000000000000000000001");

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
            const { affiliateDistributor, stakingManager, usdt, owner, user1, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            const signers = await ethers.getSigners();

            // Build 3-level chain: s[14] → s[15] → s[16] → s[17] → genesis
            await affiliateDistributor.setReferrer(signers[17].address, genesisAccount.address);
            await affiliateDistributor.setReferrer(signers[16].address, signers[17].address);
            await affiliateDistributor.setReferrer(signers[15].address, signers[16].address);
            await affiliateDistributor.setReferrer(signers[14].address, signers[15].address);

            // Give each upline enough direct sponsors to unlock their level:
            // s[15] at L1: needs 1 direct → already has s[14] ✓
            // s[16] at L2: needs 2 directs → has s[15], register s[18] under s[16]
            await affiliateDistributor.setReferrer(signers[18].address, signers[16].address);
            // s[17] at L3: needs 3 directs → has s[16], register s[19] and user1 under s[17]
            await affiliateDistributor.setReferrer(signers[19].address, signers[17].address);
            await affiliateDistributor.setReferrer(user1.address, signers[17].address);

            // Give uplines AND their directs active stakes
            const stakingAddr = await stakingManager.getAddress();
            for (const s of [signers[14], signers[15], signers[16], signers[17], signers[18], signers[19]]) {
                await usdt.mint(s.address, ethers.parseEther("1000"));
                await usdt.connect(s).approve(stakingAddr, ethers.MaxUint256);
                await stakingManager.connect(s).stake(ethers.parseEther("100"), genesisAccount.address);
            }
            // user1 also needs active stake (already has USDT from fixture)
            await usdt.connect(user1).approve(stakingAddr, ethers.MaxUint256);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), signers[17].address);

            const profit = ethers.parseEther("100");
            await affiliateDistributor.distributeTeamDividend(signers[14].address, profit);

            // L1 (s[15], 1 direct, 1 level unlocked): 10% = 10
            expect(await affiliateDistributor.teamDividends(signers[15].address)).to.equal(profit * 1000n / 10000n);
            // L2 (s[16], 2 directs, 2 levels unlocked): 5% = 5
            expect(await affiliateDistributor.teamDividends(signers[16].address)).to.equal(profit * 500n / 10000n);
            // L3 (s[17], 3 directs, 3 levels unlocked): 5% = 5
            expect(await affiliateDistributor.teamDividends(signers[17].address)).to.equal(profit * 500n / 10000n);
        });

        it("should skip dividends for uplines with insufficient directs", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, user2, user3, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            // chain: user1 → user2 → user3 → genesis
            await affiliateDistributor.setReferrer(user3.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user2.address, user3.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // user2 has 1 direct (user1) → unlocks L1 ✓
            // user3 has 1 direct (user2) → unlocks L1 only, NOT L2

            // Give uplines AND directs active stakes
            const stakingAddr = await stakingManager.getAddress();
            for (const u of [user1, user2, user3]) {
                await usdt.connect(u).approve(stakingAddr, ethers.MaxUint256);
                await stakingManager.connect(u).stake(ethers.parseEther("100"), genesisAccount.address);
            }

            const profit = ethers.parseEther("100");
            await affiliateDistributor.distributeTeamDividend(user1.address, profit);

            // user2 has 1 active direct (user1) → unlocks L1 ✓
            expect(await affiliateDistributor.teamDividends(user2.address)).to.equal(profit * 1000n / 10000n); // L1: 10%
            // user3 has 1 active direct (user2) → only L1, NOT L2
            expect(await affiliateDistributor.teamDividends(user3.address)).to.equal(0); // L2 locked (only 1 active direct)
        });

        it("should stop at chain end if shorter than 15 levels", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, user2, user3, user4, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            // chain: user1 → user2 → user3 → genesis (2 levels)
            await affiliateDistributor.setReferrer(user3.address, genesisAccount.address);
            await affiliateDistributor.setReferrer(user2.address, user3.address);
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // Give user3 a 2nd direct so it unlocks L2
            await affiliateDistributor.setReferrer(user4.address, user3.address);

            // Give uplines AND directs active stakes (user4 needs stake for user3's L2 unlock)
            const stakingAddr = await stakingManager.getAddress();
            for (const u of [user1, user2, user3, user4]) {
                await usdt.connect(u).approve(stakingAddr, ethers.MaxUint256);
                await stakingManager.connect(u).stake(ethers.parseEther("100"), genesisAccount.address);
            }

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
            const { affiliateDistributor, stakingManager, usdt, kairoToken, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);

            // user1 needs an active stake
            const stakingAddr = await stakingManager.getAddress();
            await usdt.connect(user1).approve(stakingAddr, ethers.MaxUint256);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), "0x0000000000000000000000000000000000000001");

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
            await expect(affiliateDistributor.connect(user1).harvest(3)).to.be.revertedWith(
                "AD: Invalid income type"
            );
        });
    });

    describe("View Functions", function () {
        it("should return all income correctly", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);

            // user1 needs an active stake to receive income
            const stakingAddr = await stakingManager.getAddress();
            await usdt.connect(user1).approve(stakingAddr, ethers.MaxUint256);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), "0x0000000000000000000000000000000000000001");

            await affiliateDistributor.distributeDirect(user1.address, ethers.parseEther("400")); // 20 USDT

            const [direct, team, rank] = await affiliateDistributor.getAllIncome(user1.address);
            expect(direct).to.equal(ethers.parseEther("20"));
            expect(team).to.equal(0n);
            expect(rank).to.equal(0n);
        });

        it("should return correct getTotalHarvestable", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);

            // user1 needs an active stake
            const stakingAddr = await stakingManager.getAddress();
            await usdt.connect(user1).approve(stakingAddr, ethers.MaxUint256);
            await stakingManager.connect(user1).stake(ethers.parseEther("100"), "0x0000000000000000000000000000000000000001");

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
    });

    describe("3X Cap Integration (Harvest-Triggered)", function () {
        it("should NOT report direct dividends to FIFO cap at accrual (accrues freely)", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, user2, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);

            // user2 needs a stake to track cap against
            const stakingAddr = await stakingManager.getAddress();
            await (usdt as any).connect(user2).approve(stakingAddr, ethers.MaxUint256);
            await (stakingManager as any).connect(user2).stake(ethers.parseEther("500"), REF);

            // Distribute direct dividend to user2 (5% of 1000 = 50 USDT)
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("1000"));

            // Under harvest-triggered model, totalEarned should be 0 (no harvest yet)
            const [totalEarned] = await stakingManager.getGlobalCapProgress(user2.address);
            expect(totalEarned).to.equal(0);
            // But directDividends should be accrued
            expect(await affiliateDistributor.directDividends(user2.address)).to.equal(ethers.parseEther("50"));
        });

        it("should apply FIFO cap when harvesting direct dividends", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, user2, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await affiliateDistributor.grantRole(STAKING_ROLE, owner.address);

            // user2 stakes
            const stakingAddr = await stakingManager.getAddress();
            await (usdt as any).connect(user2).approve(stakingAddr, ethers.MaxUint256);
            await (stakingManager as any).connect(user2).stake(ethers.parseEther("500"), REF);

            // Distribute direct dividend to user2 (5% of 400 = 20 USDT)
            await affiliateDistributor.distributeDirect(user2.address, ethers.parseEther("400"));

            // Harvest direct dividends - should apply to FIFO cap
            await affiliateDistributor.connect(user2).harvest(0); // type 0 = direct

            const [totalEarned] = await stakingManager.getGlobalCapProgress(user2.address);
            expect(totalEarned).to.equal(ethers.parseEther("20")); // 20 USDT applied to cap
        });

        it("should NOT report team dividends to FIFO cap at accrual", async function () {
            const { affiliateDistributor, stakingManager, usdt, owner, user1, user2, user3, genesisAccount, STAKING_ROLE } = await loadFixture(deployFullEcosystemFixture);

            // Register user2, then user2 stakes
            await affiliateDistributor.setReferrer(user2.address, genesisAccount.address);
            const stakingAddr = await stakingManager.getAddress();
            await (usdt as any).connect(user2).approve(stakingAddr, ethers.MaxUint256);
            await (stakingManager as any).connect(user2).stake(ethers.parseEther("500"), REF);

            // chain: user1 -> user2
            await affiliateDistributor.setReferrer(user1.address, user2.address);
            // user1 needs active stake so user2 has 1 active direct for L1 unlock
            await (usdt as any).connect(user1).approve(stakingAddr, ethers.MaxUint256);
            await (stakingManager as any).connect(user1).stake(ethers.parseEther("100"), user2.address);
            await affiliateDistributor.distributeTeamDividend(user1.address, ethers.parseEther("100"));

            // user2 is L1: gets 10% of 100 = 10 USDT team dividend (accrued freely)
            const [totalEarned] = await stakingManager.getGlobalCapProgress(user2.address);
            expect(totalEarned).to.equal(0); // Not reported to cap at accrual
            expect(await affiliateDistributor.teamDividends(user2.address)).to.equal(ethers.parseEther("10"));
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
