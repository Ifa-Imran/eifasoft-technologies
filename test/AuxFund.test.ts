import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("AuxFund", function () {
    describe("Price Formula", function () {
        it("should return correct initial price (USDT_balance / KAIRO_supply)", async function () {
            const { auxFund } = await loadFixture(deployFullEcosystemFixture);
            // 10,000 USDT / 10,000 KAIRO = 1 USDT/KAIRO
            const price = await auxFund.getLivePrice();
            expect(price).to.equal(ethers.parseEther("1"));
        });

        it("getCurrentPrice should equal getLivePrice", async function () {
            const { auxFund } = await loadFixture(deployFullEcosystemFixture);
            expect(await auxFund.getCurrentPrice()).to.equal(await auxFund.getLivePrice());
        });

        it("should return 1e18 when effectiveSupply is zero", async function () {
            // Deploy fresh contracts without initial supply
            const [deployer] = await ethers.getSigners();
            const MockUSDT = await ethers.getContractFactory("MockUSDT");
            const usdt = await MockUSDT.deploy();
            const KAIROToken = await ethers.getContractFactory("KAIROToken");
            const kairo = await KAIROToken.deploy(deployer.address);
            const AuxFund = await ethers.getContractFactory("AuxFund");
            const auxFund = await AuxFund.deploy(await kairo.getAddress(), await usdt.getAddress());
            // No KAIRO minted, supply = 0
            expect(await auxFund.getCurrentPrice()).to.equal(ethers.parseEther("1"));
        });

        it("should update price when USDT balance changes", async function () {
            const { auxFund, usdt, owner } = await loadFixture(deployFullEcosystemFixture);
            // Add more USDT to AuxFund
            await usdt.transfer(await auxFund.getAddress(), ethers.parseEther("10000"));
            // Now: 20,000 USDT / 10,000 KAIRO = 2 USDT/KAIRO
            expect(await auxFund.getLivePrice()).to.equal(ethers.parseEther("2"));
        });
    });

    describe("Swap KAIRO for USDT", function () {
        async function swapFixture() {
            const f = await deployFullEcosystemFixture();
            // Mint some KAIRO to user1 so they can swap
            await f.kairoToken.grantRole(f.MINTER_ROLE, f.owner.address);
            await f.kairoToken.mint(f.user1.address, ethers.parseEther("100"));
            // Approve AuxFund to spend user1's KAIRO
            await f.kairoToken.connect(f.user1).approve(await f.auxFund.getAddress(), ethers.MaxUint256);
            return f;
        }

        it("should swap KAIRO for USDT with 3% fee", async function () {
            const { auxFund, usdt, kairoToken, user1 } = await loadFixture(swapFixture);
            const kairoAmount = ethers.parseEther("10");
            const price = await auxFund.getCurrentPrice(); // 1 USDT/KAIRO
            const grossUsdt = (kairoAmount * price) / ethers.parseEther("1");
            const fee = (grossUsdt * 3n) / 100n;
            const expectedUsdt = grossUsdt - fee;

            const balBefore = await usdt.balanceOf(user1.address);
            await auxFund.connect(user1).swapKAIROForUSDT(kairoAmount, 0, user1.address);
            const balAfter = await usdt.balanceOf(user1.address);
            expect(balAfter - balBefore).to.equal(expectedUsdt);
        });

        it("should burn KAIRO on swap", async function () {
            const { auxFund, kairoToken, user1 } = await loadFixture(swapFixture);
            const totalBurnedBefore = await kairoToken.getTotalBurned();
            await auxFund.connect(user1).swapKAIROForUSDT(ethers.parseEther("10"), 0, user1.address);
            const totalBurnedAfter = await kairoToken.getTotalBurned();
            expect(totalBurnedAfter - totalBurnedBefore).to.equal(ethers.parseEther("10"));
        });

        it("should revert when deployer tries to swap", async function () {
            const { auxFund, kairoToken, owner, MINTER_ROLE } = await loadFixture(swapFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await kairoToken.mint(owner.address, ethers.parseEther("100"));
            await kairoToken.approve(await auxFund.getAddress(), ethers.MaxUint256);
            await expect(
                auxFund.swapKAIROForUSDT(ethers.parseEther("10"), 0, owner.address)
            ).to.be.revertedWith("AuxFund: Deployer cannot swap KAIRO tokens");
        });

        it("should enforce slippage protection", async function () {
            const { auxFund, user1 } = await loadFixture(swapFixture);
            // Set minUSDTOut very high
            await expect(
                auxFund.connect(user1).swapKAIROForUSDT(ethers.parseEther("10"), ethers.parseEther("100"), user1.address)
            ).to.be.revertedWith("AuxFund: Slippage too high");
        });

        it("should revert zero amount swap", async function () {
            const { auxFund, user1 } = await loadFixture(swapFixture);
            await expect(
                auxFund.connect(user1).swapKAIROForUSDT(0, 0, user1.address)
            ).to.be.revertedWith("AuxFund: Invalid KAIRO amount");
        });

        it("should update swap statistics", async function () {
            const { auxFund, user1 } = await loadFixture(swapFixture);
            await auxFund.connect(user1).swapKAIROForUSDT(ethers.parseEther("10"), 0, user1.address);
            const stats = await auxFund.getSwapStatistics();
            expect(stats.totalKAIROSwapped).to.equal(ethers.parseEther("10"));
            expect(stats.swapCount).to.equal(1);
            expect(stats.totalFeesCollected).to.be.gt(0);
        });

        it("should update price snapshot after swap", async function () {
            const { auxFund, user1 } = await loadFixture(swapFixture);
            const snapshotBefore = await auxFund.currentSnapshotIndex();
            await auxFund.connect(user1).swapKAIROForUSDT(ethers.parseEther("10"), 0, user1.address);
            const snapshotAfter = await auxFund.currentSnapshotIndex();
            expect(snapshotAfter).to.equal(snapshotBefore + 1n);
        });
    });

    describe("USDT to KAIRO swaps disabled", function () {
        it("should revert swapUSDTForKAIRO (one-way DEX)", async function () {
            const { auxFund, usdt, user1 } = await loadFixture(deployFullEcosystemFixture);
            await usdt.connect(user1).approve(await auxFund.getAddress(), ethers.MaxUint256);
            await expect(
                auxFund.connect(user1).swapUSDTForKAIRO(ethers.parseEther("100"), 0, user1.address)
            ).to.be.revertedWith("AuxFund: USDT to KAIRO swaps disabled - One-way DEX only");
        });
    });

    describe("Admin Functions", function () {
        it("should allow admin to withdrawUSDT via CORE_ROLE", async function () {
            const { auxFund, usdt, owner, user1 } = await loadFixture(deployFullEcosystemFixture);
            // Owner is not CORE_ROLE, grant it
            await auxFund.grantCoreRole(owner.address);
            const balBefore = await usdt.balanceOf(user1.address);
            await auxFund.withdrawUSDT(user1.address, ethers.parseEther("100"));
            const balAfter = await usdt.balanceOf(user1.address);
            expect(balAfter - balBefore).to.equal(ethers.parseEther("100"));
        });

        it("should revert withdrawUSDT without CORE_ROLE", async function () {
            const { auxFund, user1 } = await loadFixture(deployFullEcosystemFixture);
            await expect(auxFund.connect(user1).withdrawUSDT(user1.address, ethers.parseEther("100"))).to.be.reverted;
        });

        it("should return correct balances", async function () {
            const { auxFund, usdt } = await loadFixture(deployFullEcosystemFixture);
            const [usdtBalance, kairoBalance] = await auxFund.getBalances();
            expect(usdtBalance).to.equal(ethers.parseEther("10000"));
            expect(kairoBalance).to.equal(ethers.parseEther("10000")); // social lock
        });
    });

    describe("View Functions", function () {
        it("should return correct TVL", async function () {
            const { auxFund } = await loadFixture(deployFullEcosystemFixture);
            const tvl = await auxFund.getTotalValueLocked();
            // 10,000 USDT + 10,000 KAIRO * 1 USDT/KAIRO = 20,000
            expect(tvl).to.equal(ethers.parseEther("20000"));
        });

        it("should return deployer info", async function () {
            const { auxFund, owner } = await loadFixture(deployFullEcosystemFixture);
            expect(await auxFund.getDeployer()).to.equal(owner.address);
            expect(await auxFund.isDeployerBlocked(owner.address)).to.be.true;
        });

        it("should calculate min output correctly", async function () {
            const { auxFund } = await loadFixture(deployFullEcosystemFixture);
            const minOut = await auxFund.calculateMinOutput(ethers.parseEther("10"), 1, true);
            // 10 KAIRO * 1 USDT = 10 USDT, minus 3% fee = 9.7, minus 1% slippage = 9.603
            const gross = ethers.parseEther("10");
            const fee = (gross * 3n) / 100n;
            const net = gross - fee;
            const slip = (net * 1n) / 100n;
            expect(minOut).to.equal(net - slip);
        });
    });
});
