/**
 * pre-renounce-check.ts — Read-only audit of all roles and deployer balances.
 * Safe to run multiple times (no state changes).
 *
 * Usage:
 *   npx hardhat run scripts/pre-renounce-check.ts --network opbnbMainnet
 */

import { ethers } from "hardhat";

const KAIRO_TOKEN     = process.env.KAIRO_TOKEN_ADDRESS     || "";
const LIQUIDITY_POOL  = process.env.LIQUIDITY_POOL_ADDRESS  || "";
const STAKING_MANAGER = process.env.STAKING_MANAGER_ADDRESS || "";
const AFFILIATE_DIST  = process.env.AFFILIATE_DIST_ADDRESS  || "";
const ATOMIC_P2P      = process.env.ATOMIC_P2P_ADDRESS      || "";
const USDT_ADDRESS    = process.env.USDT_TOKEN_ADDRESS      || "0x9e5AAC1Ba1a2e6aEd6b32689DFcF62A509Ca96f3";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== PRE-RENOUNCE AUDIT (Read-Only) ===");
    console.log("Network:", (await ethers.provider.getNetwork()).chainId.toString());
    console.log("Deployer:", deployer.address);
    console.log("");

    if (!KAIRO_TOKEN || !LIQUIDITY_POOL || !STAKING_MANAGER || !AFFILIATE_DIST || !ATOMIC_P2P) {
        console.error("ERROR: Set all contract address env vars");
        process.exit(1);
    }

    // ── Wallet Balances ──
    console.log("── Deployer Wallet Balances ──");
    const bnbBal = await ethers.provider.getBalance(deployer.address);
    console.log(`  BNB:   ${ethers.formatEther(bnbBal)}`);

    const usdt = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDT_ADDRESS);
    const usdtBal = await usdt.balanceOf(deployer.address);
    console.log(`  USDT:  ${ethers.formatEther(usdtBal)}`);

    const kairoToken = await ethers.getContractAt("KAIROToken", KAIRO_TOKEN);
    const kairoBal = await kairoToken.balanceOf(deployer.address);
    console.log(`  KAIRO: ${ethers.formatEther(kairoBal)}`);
    console.log("");

    // ── Attach contracts ──
    const liquidityPool = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL);
    const stakingManager = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
    const affiliateDistributor = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DIST);
    const atomicP2p = await ethers.getContractAt("AtomicP2p", ATOMIC_P2P);

    // ── Fetch role constants ──
    const DEFAULT_ADMIN_ROLE  = await kairoToken.DEFAULT_ADMIN_ROLE();
    const MINTER_ROLE         = await kairoToken.MINTER_ROLE();
    const CORE_ROLE           = await liquidityPool.CORE_ROLE();
    const P2P_ROLE            = await liquidityPool.P2P_ROLE();
    const STAKING_ROLE        = await affiliateDistributor.STAKING_ROLE();
    const INCOME_RECORDER_ROLE = await stakingManager.INCOME_RECORDER_ROLE();
    const P2P_ADMIN_ROLE      = await atomicP2p.ADMIN_ROLE();
    const P2P_OPERATOR_ROLE   = await atomicP2p.OPERATOR_ROLE();

    let failed = false;

    // ── Setup state ──
    console.log("── Setup State Verification ──");
    const lpSet = await kairoToken.liquidityPool();
    console.log(`  KAIROToken.liquidityPool()   = ${lpSet} ${lpSet === LIQUIDITY_POOL ? "✓" : "✗ MISMATCH"}`);

    const socialLock = await kairoToken.socialLockApplied();
    console.log(`  KAIROToken.socialLockApplied = ${socialLock} ${socialLock ? "✓" : "✗"}`);
    if (!socialLock) failed = true;

    const adOnSM = await stakingManager.affiliateDistributor();
    console.log(`  SM.affiliateDistributor()    = ${adOnSM} ${adOnSM.toLowerCase() === AFFILIATE_DIST.toLowerCase() ? "✓" : "✗ MISMATCH"}`);

    const smOnAD = await affiliateDistributor.stakingManager();
    console.log(`  AD.stakingManager()          = ${smOnAD} ${smOnAD.toLowerCase() === STAKING_MANAGER.toLowerCase() ? "✓" : "✗ MISMATCH"}`);

    const migFinalized = await stakingManager.migrationFinalized();
    console.log(`  SM.migrationFinalized()      = ${migFinalized} ${migFinalized ? "✓" : "✗ MUST BE TRUE"}`);
    if (!migFinalized) failed = true;

    const smPaused = await stakingManager.paused();
    const adPaused = await affiliateDistributor.paused();
    console.log(`  SM.paused()                  = ${smPaused} ${!smPaused ? "✓" : "✗ PAUSED!"}`);
    console.log(`  AD.paused()                  = ${adPaused} ${!adPaused ? "✓" : "✗ PAUSED!"}`);
    if (smPaused || adPaused) failed = true;

    try {
        const price = await liquidityPool.getLivePrice();
        console.log(`  LP.getLivePrice()            = ${ethers.formatEther(price)} USDT/KAIRO ✓`);
    } catch {
        console.error("  LP.getLivePrice()            = REVERTED ✗");
        failed = true;
    }
    console.log("");

    // ── Cross-contract role grants ──
    console.log("── Cross-Contract Role Grants (MUST be correct) ──");
    const roleChecks = [
        { label: "KAIROToken: SM has MINTER_ROLE",  contract: kairoToken, role: MINTER_ROLE, holder: STAKING_MANAGER },
        { label: "KAIROToken: AD has MINTER_ROLE",  contract: kairoToken, role: MINTER_ROLE, holder: AFFILIATE_DIST },
        { label: "AD: SM has STAKING_ROLE",         contract: affiliateDistributor, role: STAKING_ROLE, holder: STAKING_MANAGER },
        { label: "SM: AD has INCOME_RECORDER_ROLE", contract: stakingManager, role: INCOME_RECORDER_ROLE, holder: AFFILIATE_DIST },
        { label: "LP: SM has CORE_ROLE",            contract: liquidityPool, role: CORE_ROLE, holder: STAKING_MANAGER },
        { label: "LP: P2P has P2P_ROLE",            contract: liquidityPool, role: P2P_ROLE, holder: ATOMIC_P2P },
    ];

    for (const rc of roleChecks) {
        const has = await rc.contract.hasRole(rc.role, rc.holder);
        console.log(`  ${rc.label}: ${has ? "✓" : "✗ MISSING"}`);
        if (!has) failed = true;
    }
    console.log("");

    // ── Deployer admin roles (should still have these PRE-renounce) ──
    console.log("── Deployer Admin Roles (should be TRUE before renounce) ──");
    const adminChecks = [
        { label: "KAIROToken DEFAULT_ADMIN",  contract: kairoToken, role: DEFAULT_ADMIN_ROLE },
        { label: "StakingManager DEFAULT_ADMIN", contract: stakingManager, role: DEFAULT_ADMIN_ROLE },
        { label: "AffiliateDistributor DEFAULT_ADMIN", contract: affiliateDistributor, role: DEFAULT_ADMIN_ROLE },
        { label: "LiquidityPool DEFAULT_ADMIN", contract: liquidityPool, role: DEFAULT_ADMIN_ROLE },
        { label: "AtomicP2p DEFAULT_ADMIN",  contract: atomicP2p, role: DEFAULT_ADMIN_ROLE },
        { label: "AtomicP2p ADMIN_ROLE",     contract: atomicP2p, role: P2P_ADMIN_ROLE },
    ];

    for (const ac of adminChecks) {
        const has = await ac.contract.hasRole(ac.role, deployer.address);
        console.log(`  ${ac.label}: ${has ? "✓ (will be burned)" : "✗ ALREADY RENOUNCED"}`);
        if (!has) failed = true;
    }
    console.log("");

    // ── Deployer operational roles (MUST be FALSE — danger if public key) ──
    console.log("── Deployer Operational Roles (MUST be FALSE) ──");
    const dangerChecks = [
        { label: "KAIROToken MINTER_ROLE",      contract: kairoToken, role: MINTER_ROLE },
        { label: "SM INCOME_RECORDER_ROLE",     contract: stakingManager, role: INCOME_RECORDER_ROLE },
        { label: "AD STAKING_ROLE",             contract: affiliateDistributor, role: STAKING_ROLE },
        { label: "LP CORE_ROLE",                contract: liquidityPool, role: CORE_ROLE },
        { label: "LP P2P_ROLE",                 contract: liquidityPool, role: P2P_ROLE },
        { label: "AtomicP2p OPERATOR_ROLE",     contract: atomicP2p, role: P2P_OPERATOR_ROLE },
    ];

    for (const dc of dangerChecks) {
        const has = await dc.contract.hasRole(dc.role, deployer.address);
        console.log(`  ${dc.label}: ${has ? "⚠️  DANGER — DEPLOYER HAS THIS ROLE" : "✓ safe"}`);
        if (has) failed = true;
    }
    console.log("");

    // ── Summary ──
    if (failed) {
        console.error("══════════════════════════════════════════");
        console.error("  AUDIT FAILED — DO NOT RENOUNCE YET");
        console.error("  Fix issues above before proceeding.");
        console.error("══════════════════════════════════════════");
        process.exit(1);
    } else {
        console.log("══════════════════════════════════════════");
        console.log("  ALL CHECKS PASSED ✓");
        console.log("  Safe to proceed with renounce-admin.ts");
        console.log("══════════════════════════════════════════");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Check failed:", error);
        process.exit(1);
    });
