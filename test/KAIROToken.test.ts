import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFullEcosystemFixture } from "./helpers/fixtures";

describe("KAIROToken", function () {
    describe("Deployment", function () {
        it("should have correct name and symbol", async function () {
            const { kairoToken } = await loadFixture(deployFullEcosystemFixture);
            expect(await kairoToken.name()).to.equal("KAIRO");
            expect(await kairoToken.symbol()).to.equal("KAIRO");
        });

        it("should grant DEFAULT_ADMIN_ROLE to admin", async function () {
            const { kairoToken, owner } = await loadFixture(deployFullEcosystemFixture);
            const DEFAULT_ADMIN_ROLE = await kairoToken.DEFAULT_ADMIN_ROLE();
            expect(await kairoToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });

        it("should revert deployment with zero address admin", async function () {
            const KAIROToken = await ethers.getContractFactory("KAIROToken");
            await expect(KAIROToken.deploy(ethers.ZeroAddress)).to.be.revertedWith("KAIROToken: Invalid admin");
        });
    });

    describe("Social Lock", function () {
        it("should mint 10,000 KAIRO to LP on mintInitialSupply", async function () {
            const { kairoToken, auxFund } = await loadFixture(deployFullEcosystemFixture);
            const auxFundAddress = await auxFund.getAddress();
            const balance = await kairoToken.balanceOf(auxFundAddress);
            expect(balance).to.equal(ethers.parseEther("10000"));
        });

        it("should set socialLockApplied to true", async function () {
            const { kairoToken } = await loadFixture(deployFullEcosystemFixture);
            expect(await kairoToken.socialLockApplied()).to.be.true;
        });

        it("should revert on second mintInitialSupply call", async function () {
            const { kairoToken } = await loadFixture(deployFullEcosystemFixture);
            await expect(kairoToken.mintInitialSupply()).to.be.revertedWith("KAIROToken: Social lock already applied");
        });

        it("should return correct socialLockAmount", async function () {
            const { kairoToken } = await loadFixture(deployFullEcosystemFixture);
            expect(await kairoToken.getSocialLockAmount()).to.equal(ethers.parseEther("10000"));
        });
    });

    describe("setLiquidityPool", function () {
        it("should set liquidityPool correctly", async function () {
            const { kairoToken, auxFund } = await loadFixture(deployFullEcosystemFixture);
            expect(await kairoToken.liquidityPool()).to.equal(await auxFund.getAddress());
        });

        it("should revert on second setLiquidityPool call", async function () {
            const { kairoToken, user1 } = await loadFixture(deployFullEcosystemFixture);
            await expect(kairoToken.setLiquidityPool(user1.address)).to.be.revertedWith("KAIROToken: LP already set");
        });

        it("should revert with zero address", async function () {
            // Deploy a fresh token to test zero address check
            const KAIROToken = await ethers.getContractFactory("KAIROToken");
            const [deployer] = await ethers.getSigners();
            const freshToken = await KAIROToken.deploy(deployer.address);
            await expect(freshToken.setLiquidityPool(ethers.ZeroAddress)).to.be.revertedWith("KAIROToken: Invalid LP address");
        });

        it("should revert when called by non-admin", async function () {
            const { kairoToken, user1 } = await loadFixture(deployFullEcosystemFixture);
            await expect(kairoToken.connect(user1).setLiquidityPool(user1.address)).to.be.reverted;
        });
    });

    describe("Minting", function () {
        it("should allow MINTER_ROLE to mint", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await kairoToken.mint(user1.address, ethers.parseEther("100"));
            expect(await kairoToken.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
        });

        it("should revert mint from non-MINTER_ROLE", async function () {
            const { kairoToken, user1 } = await loadFixture(deployFullEcosystemFixture);
            await expect(kairoToken.connect(user1).mint(user1.address, ethers.parseEther("100"))).to.be.reverted;
        });

        it("should revert mint to zero address", async function () {
            const { kairoToken, owner, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await expect(kairoToken.mint(ethers.ZeroAddress, ethers.parseEther("100"))).to.be.revertedWith("KAIROToken: Invalid recipient");
        });

        it("should revert mint of zero amount", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await expect(kairoToken.mint(user1.address, 0)).to.be.revertedWith("KAIROToken: Invalid amount");
        });
    });

    describe("mintTo", function () {
        it("should calculate correct KAIRO amount based on price", async function () {
            const { kairoToken, owner, user1, auxFund, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);

            const price = await auxFund.getLivePrice(); // 1 USDT/KAIRO initially
            const usdAmount = ethers.parseEther("100");
            const expectedKairo = (usdAmount * ethers.parseEther("1")) / price;

            await kairoToken.mintTo(user1.address, usdAmount);
            expect(await kairoToken.balanceOf(user1.address)).to.equal(expectedKairo);
        });

        it("should revert mintTo from non-MINTER_ROLE", async function () {
            const { kairoToken, user1 } = await loadFixture(deployFullEcosystemFixture);
            await expect(kairoToken.connect(user1).mintTo(user1.address, ethers.parseEther("100"))).to.be.reverted;
        });

        it("should revert mintTo with zero usd amount", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await expect(kairoToken.mintTo(user1.address, 0)).to.be.revertedWith("KAIROToken: Invalid USD amount");
        });
    });

    describe("Burning", function () {
        it("should allow any holder to burn their tokens", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await kairoToken.mint(user1.address, ethers.parseEther("100"));
            await kairoToken.connect(user1).burn(ethers.parseEther("50"));
            expect(await kairoToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
        });

        it("should track total burned", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await kairoToken.mint(user1.address, ethers.parseEther("100"));
            await kairoToken.connect(user1).burn(ethers.parseEther("30"));
            expect(await kairoToken.getTotalBurned()).to.equal(ethers.parseEther("30"));
        });

        it("should allow burnFrom with allowance", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await kairoToken.mint(user1.address, ethers.parseEther("100"));
            await kairoToken.connect(user1).approve(owner.address, ethers.parseEther("50"));
            await kairoToken.burnFrom(user1.address, ethers.parseEther("50"));
            expect(await kairoToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
        });

        it("should accumulate total burned across multiple burns", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await kairoToken.mint(user1.address, ethers.parseEther("100"));
            await kairoToken.connect(user1).burn(ethers.parseEther("20"));
            await kairoToken.connect(user1).burn(ethers.parseEther("10"));
            expect(await kairoToken.getTotalBurned()).to.equal(ethers.parseEther("30"));
        });
    });

    describe("View Functions", function () {
        it("should return correct effective supply (totalSupply - socialLock)", async function () {
            const { kairoToken } = await loadFixture(deployFullEcosystemFixture);
            // totalSupply = 10000 KAIRO (social lock), effectiveSupply = 0
            expect(await kairoToken.getEffectiveSupply()).to.equal(0);
        });

        it("should update effective supply after minting", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await kairoToken.mint(user1.address, ethers.parseEther("500"));
            expect(await kairoToken.getEffectiveSupply()).to.equal(ethers.parseEther("500"));
        });
    });

    describe("Access Control", function () {
        it("should allow admin to grant and revoke roles", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, user1.address);
            expect(await kairoToken.hasRole(MINTER_ROLE, user1.address)).to.be.true;

            await kairoToken.revokeRole(MINTER_ROLE, user1.address);
            expect(await kairoToken.hasRole(MINTER_ROLE, user1.address)).to.be.false;
        });

        it("should not allow non-admin to grant roles", async function () {
            const { kairoToken, user1, user2, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await expect(kairoToken.connect(user1).grantRole(MINTER_ROLE, user2.address)).to.be.reverted;
        });
    });

    describe("ERC20Permit", function () {
        it("should support permit (EIP-2612)", async function () {
            const { kairoToken, owner, user1, MINTER_ROLE } = await loadFixture(deployFullEcosystemFixture);
            await kairoToken.grantRole(MINTER_ROLE, owner.address);
            await kairoToken.mint(owner.address, ethers.parseEther("100"));

            const deadline = (await ethers.provider.getBlock("latest"))!.timestamp + 3600;
            const nonce = await kairoToken.nonces(owner.address);
            const name = await kairoToken.name();

            const domain = {
                name: name,
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await kairoToken.getAddress()
            };

            const types = {
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = ethers.parseEther("50");
            const message = {
                owner: owner.address,
                spender: user1.address,
                value: value,
                nonce: nonce,
                deadline: deadline
            };

            const sig = await owner.signTypedData(domain, types, message);
            const { v, r, s } = ethers.Signature.from(sig);

            await kairoToken.permit(owner.address, user1.address, value, deadline, v, r, s);
            expect(await kairoToken.allowance(owner.address, user1.address)).to.equal(value);
        });
    });
});
