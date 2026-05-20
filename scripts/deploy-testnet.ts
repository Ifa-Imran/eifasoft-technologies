import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DELAY = 3000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function waitTx(tx: any) {
    const receipt = await tx.wait();
    await sleep(DELAY);
    return receipt;
}

/**
 * KAIRO DeFi Ecosystem - Testnet Deployment Script
 * Deploys MockUSDT-backed stack, seeds liquidity, dumps addresses to backups/.
 * Set SKIP_BURN_ROLES=true to keep DEFAULT_ADMIN_ROLE for downstream seeding.
 *   npx hardhat run scripts/deploy-testnet.ts --network opbnbTestnet
 */
async function main() {
    const SKIP_CMS = process.env.SKIP_CMS === "true";
    const [deployer, testUser] = await ethers.getSigners();
    console.log("=== KAIRO DeFi Ecosystem - TESTNET Deployment ===");
    if (SKIP_CMS) console.log("  (SKIP_CMS=true: CoreMembershipSubscription will NOT be deployed)");
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
    console.log("");

    const systemWallet = process.env.SYSTEM_WALLET || deployer.address;

    const daoWallets = [
        '0x4465f4e53241c118a19d092d2495984f467a01a9',
        '0x3c5bB7A176F2787de0A6Ae73C6Eff4Ff5dD63295',
        '0xA91970AcA653591fd20231ad29ecCA0c7F691ceB',
        '0xe3E3Ca6feD0F6Bd26B1E684854F2B7AFB49b2805',
        '0x20d8cF481f06459FdFEAfF9219AD7a979eE06c32',
        '0xBDAb83d8eb19b0454648Db15897796BCFBB2F9B7',
    ];

    const developmentFundWallet = '0x1bdbE7e3411E6439741335f1FC9fa37Adf385E07';

    console.log("--- PHASE 1: Contract Deployment ---");

    console.log("[1/8] Deploying MockUSDT...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    await sleep(DELAY);
    const usdtAddress = await mockUSDT.getAddress();
    console.log("  MockUSDT:", usdtAddress);

    console.log("[2/8] Deploying KAIROToken...");
    const KAIROToken = await ethers.getContractFactory("KAIROToken");
    const kairoToken = await KAIROToken.deploy(deployer.address);
    await kairoToken.waitForDeployment();
    await sleep(DELAY);
    const kairoAddress = await kairoToken.getAddress();
    console.log("  KAIROToken:", kairoAddress);

    console.log("[3/8] Deploying LiquidityPool...");
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(kairoAddress, usdtAddress);
    await liquidityPool.waitForDeployment();
    await sleep(DELAY);
    const liquidityPoolAddress = await liquidityPool.getAddress();
    console.log("  LiquidityPool:", liquidityPoolAddress);

    console.log("[4/8] Configuring KAIROToken...");
    let tx = await kairoToken.setLiquidityPool(liquidityPoolAddress);
    await waitTx(tx);
    tx = await kairoToken.mintInitialSupply();
    await waitTx(tx);

    console.log("[5/8] Deploying AffiliateDistributor...");
    const AffiliateDistributor = await ethers.getContractFactory("AffiliateDistributor");
    const affiliateDistributor = await AffiliateDistributor.deploy(
        kairoAddress, liquidityPoolAddress, deployer.address, systemWallet
    );
    await affiliateDistributor.waitForDeployment();
    await sleep(DELAY);
    const affiliateAddress = await affiliateDistributor.getAddress();
    console.log("  AffiliateDistributor:", affiliateAddress);

    console.log("[6/8] Deploying StakingManager...");
    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(
        kairoAddress, liquidityPoolAddress, usdtAddress, developmentFundWallet, daoWallets, deployer.address
    );
    await stakingManager.waitForDeployment();
    await sleep(DELAY);
    const stakingAddress = await stakingManager.getAddress();
    console.log("  StakingManager:", stakingAddress);

    tx = await stakingManager.setAffiliateDistributor(affiliateAddress);
    await waitTx(tx);
    tx = await affiliateDistributor.setStakingManager(stakingAddress);
    await waitTx(tx);

    const latestBlock = await ethers.provider.getBlock("latest");
    const deploymentBlockNumber = latestBlock!.number;
    const now = latestBlock!.timestamp;
    let cms: any = null;
    let cmsAddress: string = "";
    let SUBSCRIBE_DEADLINE = 0;
    let CLAIM_DEADLINE = 0;
    if (!SKIP_CMS) {
        console.log("[7/8] Deploying CoreMembershipSubscription...");
        const CMS = await ethers.getContractFactory("CoreMembershipSubscription");
        SUBSCRIBE_DEADLINE = now + 3 * 60 * 60;
        CLAIM_DEADLINE = now + 6 * 60 * 60;
        cms = await CMS.deploy(
            kairoAddress, usdtAddress, liquidityPoolAddress,
            stakingAddress, affiliateAddress, systemWallet, deployer.address,
            SUBSCRIBE_DEADLINE, CLAIM_DEADLINE
        );
        await cms.waitForDeployment();
        await sleep(DELAY);
        cmsAddress = await cms.getAddress();
        console.log("  CoreMembershipSubscription:", cmsAddress);

        tx = await stakingManager.setCMS(cmsAddress);
        await waitTx(tx);
    } else {
        console.log("[7/8] SKIPPED (SKIP_CMS=true): CoreMembershipSubscription not deployed.");
    }

    console.log("[8/8] Deploying AtomicP2p...");
    const AtomicP2p = await ethers.getContractFactory("AtomicP2p");
    const atomicP2p = await AtomicP2p.deploy(kairoAddress, usdtAddress, liquidityPoolAddress);
    await atomicP2p.waitForDeployment();
    await sleep(DELAY);
    const p2pAddress = await atomicP2p.getAddress();
    console.log("  AtomicP2p:", p2pAddress);

    console.log("--- PHASE 2: Role Configuration ---");
    const MINTER_ROLE = await kairoToken.MINTER_ROLE();
    tx = await kairoToken.grantRole(MINTER_ROLE, stakingAddress); await waitTx(tx);
    tx = await kairoToken.grantRole(MINTER_ROLE, affiliateAddress); await waitTx(tx);
    if (!SKIP_CMS) {
        tx = await kairoToken.grantRole(MINTER_ROLE, cmsAddress); await waitTx(tx);
    }

    const STAKING_ROLE = await affiliateDistributor.STAKING_ROLE();
    if (!SKIP_CMS) {
        tx = await affiliateDistributor.grantRole(STAKING_ROLE, cmsAddress); await waitTx(tx);
    }

    tx = await liquidityPool.grantCoreRole(stakingAddress); await waitTx(tx);
    if (!SKIP_CMS) {
        tx = await liquidityPool.grantCoreRole(cmsAddress); await waitTx(tx);
    }
    tx = await liquidityPool.grantP2PRole(p2pAddress); await waitTx(tx);
    tx = await liquidityPool.setStakingManager(stakingAddress); await waitTx(tx);
    tx = await atomicP2p.setStakingManager(stakingAddress); await waitTx(tx);

    console.log("--- PHASE 3: Seed Testnet Environment ---");
    tx = await affiliateDistributor.grantRole(STAKING_ROLE, deployer.address); await waitTx(tx);
    tx = await affiliateDistributor.setReferrer(deployer.address, ethers.ZeroAddress); await waitTx(tx);

    tx = await mockUSDT.mint(deployer.address, ethers.parseEther("9000000")); await waitTx(tx);
    const INITIAL_LIQUIDITY = ethers.parseEther("10000");
    tx = await mockUSDT.transfer(liquidityPoolAddress, INITIAL_LIQUIDITY); await waitTx(tx);

    if (testUser) {
        tx = await mockUSDT.mint(testUser.address, ethers.parseEther("50000")); await waitTx(tx);
    }

    const network = await ethers.provider.getNetwork();
    {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const outDir = path.join(__dirname, "..", "backups");
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `testnet-deploy-${network.chainId}-${stamp}.json`);
        const payload = {
            network: { chainId: network.chainId.toString() },
            deployedAt: new Date().toISOString(),
            deploymentBlock: deploymentBlockNumber,
            deployer: deployer.address,
            addresses: {
                mockUSDT: usdtAddress,
                kairoToken: kairoAddress,
                liquidityPool: liquidityPoolAddress,
                affiliateDistributor: affiliateAddress,
                stakingManager: stakingAddress,
                ...(SKIP_CMS ? {} : { cms: cmsAddress }),
                atomicP2p: p2pAddress,
            },
            ...(SKIP_CMS ? {} : { deadlines: { subscribeDeadline: SUBSCRIBE_DEADLINE, claimDeadline: CLAIM_DEADLINE } }),
        };
        fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
        console.log(`Deployment addresses written: ${outPath}`);
    }

    if (process.env.SKIP_BURN_ROLES === "true") {
        console.log("--- PHASE 5: SKIPPED (SKIP_BURN_ROLES=true) ---");
        console.log("  Deployer retains DEFAULT_ADMIN_ROLE for downstream seeding.");
    } else {
        console.log("--- PHASE 5: Burn ALL Deployer Admin Roles ---");
        const DEFAULT_ADMIN_ROLE = await kairoToken.DEFAULT_ADMIN_ROLE();
        tx = await kairoToken.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address); await waitTx(tx);
        tx = await stakingManager.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address); await waitTx(tx);
        tx = await affiliateDistributor.renounceRole(STAKING_ROLE, deployer.address); await waitTx(tx);
        tx = await affiliateDistributor.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address); await waitTx(tx);
        if (!SKIP_CMS && cms) {
            tx = await cms.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address); await waitTx(tx);
        }
        tx = await liquidityPool.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address); await waitTx(tx);
        const P2P_ADMIN_ROLE = await atomicP2p.ADMIN_ROLE();
        tx = await atomicP2p.renounceRole(P2P_ADMIN_ROLE, deployer.address); await waitTx(tx);
        tx = await atomicP2p.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address); await waitTx(tx);
        console.log("  ALL DEPLOYER ADMIN ROLES BURNED.");
    }

    console.log("=============================================");
    console.log("=== TESTNET DEPLOYMENT COMPLETE ===");
    console.log("=============================================");
    console.log(`  MOCK_USDT_ADDRESS=${usdtAddress}`);
    console.log(`  KAIRO_TOKEN_ADDRESS=${kairoAddress}`);
    console.log(`  LIQUIDITY_POOL_ADDRESS=${liquidityPoolAddress}`);
    console.log(`  AFFILIATE_DISTRIBUTOR_ADDRESS=${affiliateAddress}`);
    console.log(`  STAKING_MANAGER_ADDRESS=${stakingAddress}`);
    if (!SKIP_CMS) console.log(`  CMS_ADDRESS=${cmsAddress}`);
    console.log(`  ATOMIC_P2P_ADDRESS=${p2pAddress}`);
    console.log(`  DEPLOYMENT_BLOCK=${deploymentBlockNumber}`);
    console.log(`  SYSTEM_WALLET=${systemWallet}`);
    console.log(`  DEVELOPMENT_FUND_WALLET=${developmentFundWallet}`);
    console.log(`  DAO_WALLETS=${daoWallets.join(', ')}`);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error("Testnet deployment failed:", error);
    process.exit(1);
});
