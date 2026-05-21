/**
 * renounce-admin.ts — Irreversible admin role burn for all KAIRO contracts.
 *
 * Run ONLY after:
 *   1. deploy.ts completed successfully (Steps 1-9)
 *   2. Affiliate tree seeded (seed-affiliate-tree.ts)
 *   3. Stakes migrated (seed-stakes-corrected.ts)
 *   4. Team volumes seeded (seed-team-volumes.ts)
 *   5. finalizeMigration() called on StakingManager
 *   6. All functions verified working on-chain
 *
 * Usage:
 *   npx hardhat run scripts/renounce-admin.ts --network opbnbMainnet
 */

import { ethers } from "hardhat";

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const WAIT = 5000;

// ========== Contract addresses — set these from your deploy output ==========
const KAIRO_TOKEN     = process.env.KAIRO_TOKEN_ADDRESS     || "";
const LIQUIDITY_POOL  = process.env.LIQUIDITY_POOL_ADDRESS  || "";
const STAKING_MANAGER = process.env.STAKING_MANAGER_ADDRESS || "";
const AFFILIATE_DIST  = process.env.AFFILIATE_DIST_ADDRESS  || "";
const ATOMIC_P2P      = process.env.ATOMIC_P2P_ADDRESS      || "";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=== KAIRO Admin Role Renouncement ===");
    console.log("Deployer:", deployer.address);
    console.log("");

    // ── Validate addresses ──────────────────────────────────────────────
    if (!KAIRO_TOKEN || !LIQUIDITY_POOL || !STAKING_MANAGER || !AFFILIATE_DIST || !ATOMIC_P2P) {
        console.error("ERROR: Set all contract address env vars:");
        console.error("  KAIRO_TOKEN_ADDRESS, LIQUIDITY_POOL_ADDRESS, STAKING_MANAGER_ADDRESS,");
        console.error("  AFFILIATE_DIST_ADDRESS, ATOMIC_P2P_ADDRESS");
        process.exit(1);
    }

    // ── Attach contracts ────────────────────────────────────────────────
    const kairoToken          = await ethers.getContractAt("KAIROToken", KAIRO_TOKEN);
    const liquidityPool       = await ethers.getContractAt("LiquidityPool", LIQUIDITY_POOL);
    const stakingManager      = await ethers.getContractAt("StakingManager", STAKING_MANAGER);
    const affiliateDistributor = await ethers.getContractAt("AffiliateDistributor", AFFILIATE_DIST);
    const atomicP2p           = await ethers.getContractAt("AtomicP2p", ATOMIC_P2P);

    const DEFAULT_ADMIN_ROLE    = await kairoToken.DEFAULT_ADMIN_ROLE();
    const MINTER_ROLE            = await kairoToken.MINTER_ROLE();
    const CORE_ROLE              = await liquidityPool.CORE_ROLE();
    const P2P_ROLE               = await liquidityPool.P2P_ROLE();
    const STAKING_ROLE           = await affiliateDistributor.STAKING_ROLE();
    const INCOME_RECORDER_ROLE   = await stakingManager.INCOME_RECORDER_ROLE();
    const P2P_ADMIN_ROLE         = await atomicP2p.ADMIN_ROLE();
    const P2P_OPERATOR_ROLE      = await atomicP2p.OPERATOR_ROLE();

    // ══════════════════════════════════════════════════════════════════
    //  PRE-FLIGHT VERIFICATION — abort if anything is wrong
    // ══════════════════════════════════════════════════════════════════
    console.log("── Pre-flight checks ──");
    let failed = false;

    // 1. KAIROToken: liquidityPool set + socialLockApplied
    const lpSet = await kairoToken.liquidityPool();
    if (lpSet === ethers.ZeroAddress) {
        console.error("  FAIL: KAIROToken.liquidityPool is zero — setLiquidityPool not called");
        failed = true;
    } else {
        console.log("  OK: KAIROToken.liquidityPool =", lpSet);
    }

    const socialLock = await kairoToken.socialLockApplied();
    if (!socialLock) {
        console.error("  FAIL: socialLockApplied is false — mintInitialSupply not called");
        failed = true;
    } else {
        console.log("  OK: socialLockApplied = true");
    }

    // 2. MINTER_ROLE granted to SM + AD
    const smHasMinter = await kairoToken.hasRole(MINTER_ROLE, STAKING_MANAGER);
    const adHasMinter = await kairoToken.hasRole(MINTER_ROLE, AFFILIATE_DIST);
    if (!smHasMinter) { console.error("  FAIL: StakingManager missing MINTER_ROLE"); failed = true; }
    else { console.log("  OK: StakingManager has MINTER_ROLE"); }
    if (!adHasMinter) { console.error("  FAIL: AffiliateDistributor missing MINTER_ROLE"); failed = true; }
    else { console.log("  OK: AffiliateDistributor has MINTER_ROLE"); }

    // 3. LiquidityPool roles
    const smHasCore = await liquidityPool.hasRole(CORE_ROLE, STAKING_MANAGER);
    if (!smHasCore) { console.error("  FAIL: StakingManager missing CORE_ROLE on LP"); failed = true; }
    else { console.log("  OK: StakingManager has CORE_ROLE on LP"); }

    const p2pHasP2P = await liquidityPool.hasRole(P2P_ROLE, ATOMIC_P2P);
    if (!p2pHasP2P) { console.error("  FAIL: AtomicP2p missing P2P_ROLE on LP"); failed = true; }
    else { console.log("  OK: AtomicP2p has P2P_ROLE on LP"); }

    // 4. SM ↔ AD bidirectional linking
    const adOnSM = await stakingManager.affiliateDistributor();
    if (adOnSM === ethers.ZeroAddress) { console.error("  FAIL: SM.affiliateDistributor not set"); failed = true; }
    else { console.log("  OK: SM.affiliateDistributor =", adOnSM); }

    const smOnAD = await affiliateDistributor.stakingManager();
    if (smOnAD === ethers.ZeroAddress) { console.error("  FAIL: AD.stakingManager not set"); failed = true; }
    else { console.log("  OK: AD.stakingManager =", smOnAD); }

    const smHasStaking = await affiliateDistributor.hasRole(STAKING_ROLE, STAKING_MANAGER);
    if (!smHasStaking) { console.error("  FAIL: SM missing STAKING_ROLE on AD"); failed = true; }
    else { console.log("  OK: StakingManager has STAKING_ROLE on AD"); }

    // 5. Migration finalized
    const migFinalized = await stakingManager.migrationFinalized();
    if (!migFinalized) {
        console.error("  FAIL: StakingManager.migrationFinalized is false — call finalizeMigration() first");
        failed = true;
    } else {
        console.log("  OK: migrationFinalized = true");
    }

    // 6. Contracts NOT paused
    const smPaused = await stakingManager.paused();
    const adPaused = await affiliateDistributor.paused();
    if (smPaused) { console.error("  FAIL: StakingManager is PAUSED"); failed = true; }
    else { console.log("  OK: StakingManager is not paused"); }
    if (adPaused) { console.error("  FAIL: AffiliateDistributor is PAUSED"); failed = true; }
    else { console.log("  OK: AffiliateDistributor is not paused"); }

    // 7. LP price oracle works
    try {
        const price = await liquidityPool.getLivePrice();
        console.log("  OK: LP price oracle =", ethers.formatEther(price), "USDT/KAIRO");
    } catch (e) {
        console.error("  FAIL: LP.getLivePrice() reverted — LP may not be funded");
        failed = true;
    }

    // 8. Deployer still has admin on all contracts
    const deployerHasAdmin = await kairoToken.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    if (!deployerHasAdmin) {
        console.error("  FAIL: Deployer already lost admin on KAIROToken — already renounced?");
        failed = true;
    } else {
        console.log("  OK: Deployer has admin on KAIROToken");
    }

    // 9. AffiliateDistributor has INCOME_RECORDER_ROLE on StakingManager
    const adHasRecorder = await stakingManager.hasRole(INCOME_RECORDER_ROLE, AFFILIATE_DIST);
    if (!adHasRecorder) { console.error("  FAIL: AffiliateDistributor missing INCOME_RECORDER_ROLE on SM"); failed = true; }
    else { console.log("  OK: AffiliateDistributor has INCOME_RECORDER_ROLE on SM"); }

    // 10. Deployer MUST NOT hold dangerous operational roles
    console.log("");
    console.log("── Deployer operational role safety checks ──");
    const deployerHasMinter = await kairoToken.hasRole(MINTER_ROLE, deployer.address);
    if (deployerHasMinter) { console.error("  DANGER: Deployer has MINTER_ROLE on KAIROToken — revoke it!"); failed = true; }
    else { console.log("  OK: Deployer does NOT have MINTER_ROLE on KAIROToken"); }

    const deployerHasRecorder = await stakingManager.hasRole(INCOME_RECORDER_ROLE, deployer.address);
    if (deployerHasRecorder) { console.error("  DANGER: Deployer has INCOME_RECORDER_ROLE on SM — revoke it!"); failed = true; }
    else { console.log("  OK: Deployer does NOT have INCOME_RECORDER_ROLE on SM"); }

    const deployerHasStaking = await affiliateDistributor.hasRole(STAKING_ROLE, deployer.address);
    if (deployerHasStaking) { console.warn("  WARN: Deployer has STAKING_ROLE on AD — will be revoked before burn"); }
    else { console.log("  OK: Deployer does NOT have STAKING_ROLE on AD"); }

    const deployerHasCore = await liquidityPool.hasRole(CORE_ROLE, deployer.address);
    if (deployerHasCore) { console.error("  DANGER: Deployer has CORE_ROLE on LP — revoke it!"); failed = true; }
    else { console.log("  OK: Deployer does NOT have CORE_ROLE on LP"); }

    const deployerHasP2PRole = await liquidityPool.hasRole(P2P_ROLE, deployer.address);
    if (deployerHasP2PRole) { console.error("  DANGER: Deployer has P2P_ROLE on LP — revoke it!"); failed = true; }
    else { console.log("  OK: Deployer does NOT have P2P_ROLE on LP"); }

    const deployerHasOperator = await atomicP2p.hasRole(P2P_OPERATOR_ROLE, deployer.address);
    if (deployerHasOperator) { console.error("  DANGER: Deployer has OPERATOR_ROLE on AtomicP2p — revoke it!"); failed = true; }
    else { console.log("  OK: Deployer does NOT have OPERATOR_ROLE on AtomicP2p"); }

    console.log("");

    if (failed) {
        console.error("══════════════════════════════════════════");
        console.error("  ABORTED: Pre-flight checks failed.");
        console.error("  Fix the issues above before re-running.");
        console.error("══════════════════════════════════════════");
        process.exit(1);
    }

    console.log("  ALL PRE-FLIGHT CHECKS PASSED");
    console.log("");

    // ══════════════════════════════════════════════════════════════════
    //  REVOKE DANGEROUS OPERATIONAL ROLES FROM DEPLOYER
    // ══════════════════════════════════════════════════════════════════
    console.log("── Revoking operational roles from deployer ──");

    // Check and revoke STAKING_ROLE if deployer has it (from seeding scripts)
    const deployerHasStakingPre = await affiliateDistributor.hasRole(STAKING_ROLE, deployer.address);
    if (deployerHasStakingPre) {
        let tx = await affiliateDistributor.revokeRole(STAKING_ROLE, deployer.address);
        await tx.wait();
        await delay(WAIT);
        console.log("  [REVOKED] STAKING_ROLE from deployer on AffiliateDistributor");
    } else {
        console.log("  OK: Deployer does not have STAKING_ROLE (skip)");
    }
    console.log("");

    // ══════════════════════════════════════════════════════════════════
    //  BURN ALL ADMIN ROLES — IRREVERSIBLE
    // ══════════════════════════════════════════════════════════════════
    console.log("══════════════════════════════════════════");
    console.log("  BURNING ALL ADMIN ROLES — THIS IS IRREVERSIBLE");
    console.log("══════════════════════════════════════════");
    console.log("");

    // 1. KAIROToken
    let tx = await kairoToken.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] KAIROToken DEFAULT_ADMIN_ROLE");

    // 2. StakingManager
    tx = await stakingManager.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] StakingManager DEFAULT_ADMIN_ROLE");

    // 3. AffiliateDistributor
    tx = await affiliateDistributor.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] AffiliateDistributor DEFAULT_ADMIN_ROLE");

    // 4. LiquidityPool
    tx = await liquidityPool.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] LiquidityPool DEFAULT_ADMIN_ROLE");

    // 5. AtomicP2p (both ADMIN_ROLE and DEFAULT_ADMIN_ROLE)
    tx = await atomicP2p.renounceRole(P2P_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] AtomicP2p ADMIN_ROLE");

    tx = await atomicP2p.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx.wait();
    await delay(WAIT);
    console.log("  [BURNED] AtomicP2p DEFAULT_ADMIN_ROLE");

    // ── Post-burn verification ──────────────────────────────────────────
    console.log("");
    console.log("── Post-burn verification ──");

    const checks = [
        { name: "KAIROToken",          contract: kairoToken,          role: DEFAULT_ADMIN_ROLE },
        { name: "StakingManager",      contract: stakingManager,      role: DEFAULT_ADMIN_ROLE },
        { name: "AffiliateDistributor", contract: affiliateDistributor, role: DEFAULT_ADMIN_ROLE },
        { name: "LiquidityPool",       contract: liquidityPool,       role: DEFAULT_ADMIN_ROLE },
    ];

    let postFailed = false;
    for (const c of checks) {
        const still = await c.contract.hasRole(c.role, deployer.address);
        if (still) {
            console.error(`  WARNING: ${c.name} — deployer STILL has admin!`);
            postFailed = true;
        } else {
            console.log(`  CONFIRMED: ${c.name} — deployer has NO admin`);
        }
    }

    const p2pAdmin  = await atomicP2p.hasRole(P2P_ADMIN_ROLE, deployer.address);
    const p2pDefault = await atomicP2p.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
    if (!p2pAdmin && !p2pDefault) {
        console.log("  CONFIRMED: AtomicP2p — deployer has NO admin (both roles burned)");
    } else {
        console.error("  WARNING: AtomicP2p — deployer still has admin role(s)!");
        postFailed = true;
    }

    // Full role sweep — confirm deployer has ZERO roles anywhere
    console.log("");
    console.log("── Full role sweep ──");
    const roleSweep = [
        { name: "KAIROToken MINTER_ROLE",       contract: kairoToken,          role: MINTER_ROLE },
        { name: "SM INCOME_RECORDER_ROLE",      contract: stakingManager,      role: INCOME_RECORDER_ROLE },
        { name: "AD STAKING_ROLE",              contract: affiliateDistributor, role: STAKING_ROLE },
        { name: "LP CORE_ROLE",                 contract: liquidityPool,       role: CORE_ROLE },
        { name: "LP P2P_ROLE",                  contract: liquidityPool,       role: P2P_ROLE },
        { name: "AtomicP2p OPERATOR_ROLE",      contract: atomicP2p,           role: P2P_OPERATOR_ROLE },
    ];

    for (const r of roleSweep) {
        const has = await r.contract.hasRole(r.role, deployer.address);
        if (has) {
            console.error(`  WARNING: Deployer STILL has ${r.name}!`);
            postFailed = true;
        } else {
            console.log(`  CONFIRMED: Deployer has NO ${r.name}`);
        }
    }

    console.log("");
    if (postFailed) {
        console.error("══════════════════════════════════════════");
        console.error("  WARNING: Some roles were NOT burned!");
        console.error("  Review output above before revealing key.");
        console.error("══════════════════════════════════════════");
        process.exit(1);
    }

    console.log("══════════════════════════════════════════");
    console.log("  ALL ADMIN ROLES BURNED SUCCESSFULLY");
    console.log("  System is now fully decentralized.");
    console.log("  Deployer key has ZERO on-chain powers.");
    console.log("  SAFE TO REVEAL PRIVATE KEY.");
    console.log("══════════════════════════════════════════");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Renounce failed:", error);
        process.exit(1);
    });
