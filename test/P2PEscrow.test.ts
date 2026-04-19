import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("P2PEscrow", function () {
    async function p2pFixture() {
        const f = await deployFullEcosystemFixture();
        const p2pAddr = await f.p2pEscrow.getAddress();

        // Mint KAIRO to users for sell orders
        await f.kairoToken.grantRole(f.MINTER_ROLE, f.owner.address);
        await f.kairoToken.mint(f.user1.address, ethers.parseEther("1000"));
        await f.kairoToken.mint(f.user2.address, ethers.parseEther("1000"));
        await f.kairoToken.mint(f.user3.address, ethers.parseEther("1000"));

        // Approve P2PEscrow for USDT and KAIRO from all users
        for (const user of [f.user1, f.user2, f.user3]) {
            await f.usdt.connect(user).approve(p2pAddr, ethers.MaxUint256);
            await f.kairoToken.connect(user).approve(p2pAddr, ethers.MaxUint256);
        }
        return f;
    }

    describe("Buy Orders", function () {
        it("should create a buy order and lock USDT", async function () {
            const { p2pEscrow, usdt, user1 } = await loadFixture(p2pFixture);
            const amount = ethers.parseEther("100");
            const balBefore = await usdt.balanceOf(user1.address);
            await p2pEscrow.connect(user1).createBuyOrder(amount);
            const balAfter = await usdt.balanceOf(user1.address);
            expect(balBefore - balAfter).to.equal(amount);

            const order = await p2pEscrow.getBuyOrder(1);
            expect(order.creator).to.equal(user1.address);
            expect(order.usdtAmount).to.equal(amount);
            expect(order.usdtRemaining).to.equal(amount);
            expect(order.active).to.be.true;
        });

        it("should revert buy order with zero amount", async function () {
            const { p2pEscrow, user1 } = await loadFixture(p2pFixture);
            await expect(p2pEscrow.connect(user1).createBuyOrder(0)).to.be.revertedWith("Amount must be positive");
        });

        it("should cancel buy order and refund USDT", async function () {
            const { p2pEscrow, usdt, user1 } = await loadFixture(p2pFixture);
            const amount = ethers.parseEther("100");
            await p2pEscrow.connect(user1).createBuyOrder(amount);

            const balBefore = await usdt.balanceOf(user1.address);
            await p2pEscrow.connect(user1).cancelBuyOrder(1);
            const balAfter = await usdt.balanceOf(user1.address);
            expect(balAfter - balBefore).to.equal(amount);

            const order = await p2pEscrow.getBuyOrder(1);
            expect(order.active).to.be.false;
        });

        it("should revert cancel by non-creator", async function () {
            const { p2pEscrow, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await expect(p2pEscrow.connect(user2).cancelBuyOrder(1)).to.be.revertedWith("Not order creator");
        });

        it("should revert cancel of already cancelled order", async function () {
            const { p2pEscrow, user1 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user1).cancelBuyOrder(1);
            await expect(p2pEscrow.connect(user1).cancelBuyOrder(1)).to.be.revertedWith("Order not active");
        });
    });

    describe("Sell Orders", function () {
        it("should create a sell order and lock KAIRO", async function () {
            const { p2pEscrow, kairoToken, user1 } = await loadFixture(p2pFixture);
            const amount = ethers.parseEther("50");
            const balBefore = await kairoToken.balanceOf(user1.address);
            await p2pEscrow.connect(user1).createSellOrder(amount);
            const balAfter = await kairoToken.balanceOf(user1.address);
            expect(balBefore - balAfter).to.equal(amount);

            const order = await p2pEscrow.getSellOrder(1);
            expect(order.creator).to.equal(user1.address);
            expect(order.kairoAmount).to.equal(amount);
            expect(order.active).to.be.true;
        });

        it("should revert sell order with zero amount", async function () {
            const { p2pEscrow, user1 } = await loadFixture(p2pFixture);
            await expect(p2pEscrow.connect(user1).createSellOrder(0)).to.be.revertedWith("Amount must be positive");
        });

        it("should cancel sell order and refund KAIRO", async function () {
            const { p2pEscrow, kairoToken, user1 } = await loadFixture(p2pFixture);
            const amount = ethers.parseEther("50");
            await p2pEscrow.connect(user1).createSellOrder(amount);

            const balBefore = await kairoToken.balanceOf(user1.address);
            await p2pEscrow.connect(user1).cancelSellOrder(1);
            const balAfter = await kairoToken.balanceOf(user1.address);
            expect(balAfter - balBefore).to.equal(amount);
        });
    });

    describe("Trade Execution (executeTrade)", function () {
        it("should execute a trade between buy and sell orders", async function () {
            const { p2pEscrow, usdt, kairoToken, user1, user2 } = await loadFixture(p2pFixture);

            // user1 creates buy order (100 USDT)
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            // user2 creates sell order (50 KAIRO)
            await p2pEscrow.connect(user2).createSellOrder(ethers.parseEther("50"));

            // Execute trade for 50 KAIRO
            const kairoFillAmount = ethers.parseEther("50");
            await p2pEscrow.executeTrade(1, 1, kairoFillAmount);

            // Verify trade executed
            const trade = await p2pEscrow.getTrade(1);
            expect(trade.buyer).to.equal(user1.address);
            expect(trade.seller).to.equal(user2.address);
            expect(trade.kairoAmount).to.equal(kairoFillAmount);
        });

        it("should apply 5% fee on both sides", async function () {
            const { p2pEscrow, usdt, kairoToken, liquidityPool, user1, user2 } = await loadFixture(p2pFixture);

            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user2).createSellOrder(ethers.parseEther("50"));

            const kairoFill = ethers.parseEther("50");
            const price = await liquidityPool.getCurrentPrice(); // 1e18
            const usdtRequired = (kairoFill * price) / ethers.parseEther("1");

            const user2UsdtBefore = await usdt.balanceOf(user2.address);
            const user1KairoBefore = await kairoToken.balanceOf(user1.address);

            await p2pEscrow.executeTrade(1, 1, kairoFill);

            // Check fees: 5% on each side
            const usdtFee = (usdtRequired * 500n) / 10000n;
            const kairoFee = (kairoFill * 500n) / 10000n;

            const user2UsdtAfter = await usdt.balanceOf(user2.address);
            const user1KairoAfter = await kairoToken.balanceOf(user1.address);

            // Seller receives USDT minus fee
            expect(user2UsdtAfter - user2UsdtBefore).to.equal(usdtRequired - usdtFee);
            // Buyer receives KAIRO minus fee
            expect(user1KairoAfter - user1KairoBefore).to.equal(kairoFill - kairoFee);
        });

        it("should burn KAIRO fee", async function () {
            const { p2pEscrow, kairoToken, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user2).createSellOrder(ethers.parseEther("50"));

            const burnedBefore = await kairoToken.getTotalBurned();
            await p2pEscrow.executeTrade(1, 1, ethers.parseEther("50"));
            const burnedAfter = await kairoToken.getTotalBurned();

            const kairoFee = (ethers.parseEther("50") * 500n) / 10000n;
            expect(burnedAfter - burnedBefore).to.equal(kairoFee);
        });

        it("should send USDT fee to LiquidityPool", async function () {
            const { p2pEscrow, usdt, liquidityPool, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user2).createSellOrder(ethers.parseEther("50"));

            // Get price BEFORE trade to match what the contract uses
            const priceBefore = await liquidityPool.getCurrentPrice();
            const kairoFill = ethers.parseEther("50");
            const usdtRequired = (kairoFill * priceBefore) / ethers.parseEther("1");
            const usdtFee = (usdtRequired * 500n) / 10000n;

            const lpBefore = await usdt.balanceOf(await liquidityPool.getAddress());
            await p2pEscrow.executeTrade(1, 1, kairoFill);
            const lpAfter = await usdt.balanceOf(await liquidityPool.getAddress());

            expect(lpAfter - lpBefore).to.equal(usdtFee);
        });

        it("should revert trade with self", async function () {
            const { p2pEscrow, user1 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user1).createSellOrder(ethers.parseEther("50"));
            await expect(
                p2pEscrow.executeTrade(1, 1, ethers.parseEther("50"))
            ).to.be.revertedWith("P2P: Cannot trade with yourself");
        });

        it("should revert on inactive buy order", async function () {
            const { p2pEscrow, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user2).createSellOrder(ethers.parseEther("50"));
            await p2pEscrow.connect(user1).cancelBuyOrder(1);
            await expect(
                p2pEscrow.executeTrade(1, 1, ethers.parseEther("50"))
            ).to.be.revertedWith("P2P: Buy order inactive");
        });
    });

    describe("Partial Fills", function () {
        it("should support partial fill of buy order", async function () {
            const { p2pEscrow, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user2).createSellOrder(ethers.parseEther("20"));

            await p2pEscrow.executeTrade(1, 1, ethers.parseEther("20"));

            const buyOrder = await p2pEscrow.getBuyOrder(1);
            expect(buyOrder.active).to.be.true; // Still active with remaining USDT
            expect(buyOrder.usdtRemaining).to.be.lt(buyOrder.usdtAmount);
        });

        it("should support partial fill of sell order", async function () {
            const { p2pEscrow, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("20"));
            await p2pEscrow.connect(user2).createSellOrder(ethers.parseEther("100"));

            await p2pEscrow.executeTrade(1, 1, ethers.parseEther("20"));

            const sellOrder = await p2pEscrow.getSellOrder(1);
            expect(sellOrder.active).to.be.true;
            expect(sellOrder.kairoRemaining).to.equal(ethers.parseEther("80"));
        });
    });

    describe("Taker Functions", function () {
        it("should allow sellToOrder (taker sells KAIRO to buy order)", async function () {
            const { p2pEscrow, usdt, kairoToken, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));

            const user2UsdtBefore = await usdt.balanceOf(user2.address);
            await p2pEscrow.connect(user2).sellToOrder(1, ethers.parseEther("50"));
            const user2UsdtAfter = await usdt.balanceOf(user2.address);
            expect(user2UsdtAfter).to.be.gt(user2UsdtBefore);
        });

        it("should allow buyFromOrder (taker buys KAIRO from sell order)", async function () {
            const { p2pEscrow, kairoToken, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createSellOrder(ethers.parseEther("50"));

            const user2KairoBefore = await kairoToken.balanceOf(user2.address);
            await p2pEscrow.connect(user2).buyFromOrder(1, ethers.parseEther("50"));
            const user2KairoAfter = await kairoToken.balanceOf(user2.address);
            expect(user2KairoAfter).to.be.gt(user2KairoBefore);
        });

        it("should revert sellToOrder against own order", async function () {
            const { p2pEscrow, user1 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await expect(
                p2pEscrow.connect(user1).sellToOrder(1, ethers.parseEther("50"))
            ).to.be.revertedWith("P2P: Cannot trade with yourself");
        });

        it("should revert buyFromOrder against own order", async function () {
            const { p2pEscrow, user1 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createSellOrder(ethers.parseEther("50"));
            await expect(
                p2pEscrow.connect(user1).buyFromOrder(1, ethers.parseEther("50"))
            ).to.be.revertedWith("P2P: Cannot trade with yourself");
        });
    });

    describe("View & Statistics", function () {
        it("should return correct order book stats", async function () {
            const { p2pEscrow, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user2).createSellOrder(ethers.parseEther("50"));

            const stats = await p2pEscrow.getOrderBookStats();
            expect(stats.totalBuyOrders).to.equal(1);
            expect(stats.totalSellOrders).to.equal(1);
            expect(stats.activeBuyOrders).to.equal(1);
            expect(stats.activeSellOrders).to.equal(1);
        });

        it("should return user orders", async function () {
            const { p2pEscrow, user1 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user1).createSellOrder(ethers.parseEther("50"));

            const [buyIds, sellIds] = await p2pEscrow.getUserOrders(user1.address);
            expect(buyIds.length).to.equal(1);
            expect(sellIds.length).to.equal(1);
        });

        it("should simulate trade correctly", async function () {
            const { p2pEscrow, user1, user2 } = await loadFixture(p2pFixture);
            await p2pEscrow.connect(user1).createBuyOrder(ethers.parseEther("100"));
            await p2pEscrow.connect(user2).createSellOrder(ethers.parseEther("50"));

            const [netKairo, netUsdt, kairoFee, usdtFee, canExecute] = 
                await p2pEscrow.simulateTrade(1, 1, ethers.parseEther("50"));
            expect(canExecute).to.be.true;
            expect(netKairo).to.be.gt(0);
            expect(netUsdt).to.be.gt(0);
            expect(kairoFee).to.be.gt(0);
            expect(usdtFee).to.be.gt(0);
        });
    });
});
