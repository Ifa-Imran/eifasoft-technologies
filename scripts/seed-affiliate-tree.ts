import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Seed the affiliate tree on the v30 testnet AffiliateDistributor by replaying
 * referrer relationships from a backup snapshot.
 *
 * The seed script previously only replayed STAKES (StakingManager.migrateStakes).
 * It never seeded `referrerOf` on the AffiliateDistributor, so all migrated wallets
 * appear "unregistered" to the frontend (referrerOf == 0x0).
 *
 * This script:
 *   1. Loads snapshot.json, finds genesis account and all (user -> referrer) edges
 *   2. Topologically sorts users (referrer must be processed before child)
 *   3. Grants STAKING_ROLE to the deployer on the AffiliateDistributor
 *   4. For each user in order:
 *      - Skips if referrerOf[user] is already set on-chain
 *      - For genesis: calls setReferrer(genesis, address(0)) to bootstrap
 *      - For others: calls setReferrer(user, referrer)
 *   5. Revokes STAKING_ROLE
 *
 * Required env:
 *   AFFILIATE_DISTRIBUTOR  - testnet AffiliateDistributor address
 * Optional env:
 *   SNAPSHOT_FILE          - defaults to backups/snapshot.json
 *   DRY_RUN=true           - log actions only, no transactions
 *   START_INDEX=N          - resume from index N (after a failure)
 *
 * Run: npx hardhat run scripts/seed-affiliate-tree.ts --network opbnbTestnet
 */

const AD_ADDRESS = process.env.AFFILIATE_DISTRIBUTOR || "";
const SNAPSHOT_FILE = process.env.SNAPSHOT_FILE || path.join(__dirname, "..", "backups", "snapshot.json");
const DRY_RUN = process.env.DRY_RUN === "true";
const START_INDEX = Number(process.env.START_INDEX || "0");

const ZERO = ethers.ZeroAddress;

interface SnapshotUser {
  user: string;
  affiliate?: { referrer?: string };
  referrer?: string; // correct-tree.json flat format
}

interface Snapshot {
  meta?: { network?: { chainId?: string }; addresses?: any };
  global?: { affiliate?: { genesisAccount?: string } };
  genesis?: string; // correct-tree.json
  users: SnapshotUser[];
}

async function main() {
  if (!ethers.isAddress(AD_ADDRESS)) {
    throw new Error(`AFFILIATE_DISTRIBUTOR env var is required and must be a valid address. Got: ${AD_ADDRESS}`);
  }
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    throw new Error(`Snapshot not found at ${SNAPSHOT_FILE}`);
  }

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("=== seed-affiliate-tree ===");
  console.log("  signer            :", signer.address);
  console.log("  network           :", network.name, `(chainId ${network.chainId})`);
  console.log("  AD address        :", AD_ADDRESS);
  console.log("  snapshot file     :", SNAPSHOT_FILE);
  console.log("  dry run           :", DRY_RUN);
  console.log("  start index       :", START_INDEX);

  const snap: Snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
  const snapshotGenesis: string = (snap.global?.affiliate?.genesisAccount || snap.genesis || "").toLowerCase();
  const genesisLower = snapshotGenesis;
  if (!ethers.isAddress(genesisLower)) {
    throw new Error(`Snapshot has invalid genesisAccount: ${genesisLower}`);
  }
  console.log("  genesis (snapshot):", genesisLower);
  console.log("  total users       :", snap.users.length);

  // Build referrer map (user -> referrer). Use lowercase canonical form.
  // Supports both snapshot.json (nested affiliate.referrer) and correct-tree.json (flat referrer).
  const refMap = new Map<string, string>();
  for (const u of snap.users) {
    const userLower = u.user.toLowerCase();
    const refRaw = u.affiliate?.referrer || u.referrer || ZERO;
    const refLower = refRaw.toLowerCase();
    if (!ethers.isAddress(userLower)) continue;
    refMap.set(userLower, refLower);
  }

  // Topological sort.
  // The testnet AffiliateDistributor was bootstrapped at deploy with the
  // deployer (signer) as on-chain genesis. We graft the snapshot tree under
  // the on-chain genesis by setting snapshotGenesis.referrer = onChainGenesis.
  const ordered: { user: string; referrer: string }[] = [];
  const placed = new Set<string>();

  // Connect to contract
  const ad = await ethers.getContractAt("AffiliateDistributor", AD_ADDRESS);

  // The on-chain genesis is whatever was set at deploy (likely the deployer).
  // We graft the snapshot tree as children of it.
  const onChainGenesis: string = await ad.genesisAccount();
  console.log("  genesis (on-chain):", onChainGenesis);
  if (onChainGenesis === ZERO) {
    throw new Error(
      "On-chain AffiliateDistributor has no genesisAccount yet. Bootstrap it first by registering one user."
    );
  }
  const onChainGenesisLower = onChainGenesis.toLowerCase();

  // The on-chain genesis is implicitly placed (already on-chain).
  placed.add(onChainGenesisLower);

  // 1) First pass: graft "chain heads" (users whose referrer is 0x0 in the
  //    snapshot, or whose referrer is missing from the user set) directly
  //    under the on-chain genesis. This becomes the seed of the tree.
  let graftedCount = 0;
  for (const [user, referrer] of refMap) {
    if (user === onChainGenesisLower) continue;
    // Self-loop indicates this is the snapshot's root (genesis). Graft it to the
    // on-chain genesis so descendants can chain underneath.
    const isSelfLoop = referrer === user;
    const refMissing =
      referrer === ZERO ||
      isSelfLoop ||
      (!refMap.has(referrer) && referrer !== onChainGenesisLower);
    if (refMissing) {
      ordered.push({ user, referrer: onChainGenesisLower });
      placed.add(user);
      graftedCount++;
    }
  }

  // 2) Second pass: BFS the remaining users (those with valid in-set referrers)
  //    placing each user under their actual snapshot referrer once the referrer
  //    has been placed. Preserves the original upline relationships.
  let chainedCount = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [user, referrer] of refMap) {
      if (placed.has(user)) continue;
      if (placed.has(referrer)) {
        ordered.push({ user, referrer });
        placed.add(user);
        chainedCount++;
        progressed = true;
      }
    }
  }

  // 3) Final fallback: anything still unplaced (shouldn't happen) graft to genesis.
  for (const [user] of refMap) {
    if (placed.has(user)) continue;
    if (user === onChainGenesisLower) continue;
    ordered.push({ user, referrer: onChainGenesisLower });
    placed.add(user);
    graftedCount++;
  }

  console.log(`  ordered (placed)  : ${ordered.length}`);
  console.log(`  grafted to genesis: ${graftedCount}`);
  console.log(`  chained (real ref): ${chainedCount}`);

  // Role checks
  const DEFAULT_ADMIN_ROLE: string = await ad.DEFAULT_ADMIN_ROLE();
  const STAKING_ROLE: string = await ad.STAKING_ROLE();
  const hasAdmin: boolean = await ad.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  const hasStaking: boolean = await ad.hasRole(STAKING_ROLE, signer.address);
  console.log("  signer hasAdmin   :", hasAdmin);
  console.log("  signer hasStaking :", hasStaking);

  if (!hasAdmin && !hasStaking) {
    throw new Error("Signer needs DEFAULT_ADMIN_ROLE (to grant STAKING_ROLE) or STAKING_ROLE directly");
  }

  if (DRY_RUN) {
    console.log("DRY_RUN=true. First 10 ordered ops:");
    for (const op of ordered.slice(0, 10)) {
      console.log(`  setReferrer(${op.user}, ${op.referrer})`);
    }
    console.log(`...total ops: ${ordered.length}`);
    return;
  }

  // Grant STAKING_ROLE if not already granted
  let grantedHere = false;
  if (!hasStaking) {
    console.log("Granting STAKING_ROLE to signer...");
    const tx = await ad.grantRole(STAKING_ROLE, signer.address);
    await tx.wait();
    grantedHere = true;
    console.log("  granted, tx:", tx.hash);
  }

  // Process in order
  console.log(`Submitting setReferrer calls (starting at index ${START_INDEX})...`);
  let okCount = 0;
  let skipCount = 0;
  let failCount = 0;
  const startedAt = Date.now();

  for (let i = START_INDEX; i < ordered.length; i++) {
    const { user, referrer } = ordered[i];

    // Pre-check on-chain: skip if already set
    let already: string;
    try {
      already = await ad.referrerOf(user);
    } catch (e) {
      already = ZERO;
    }
    if (already !== ZERO) {
      skipCount++;
      if (i % 25 === 0) console.log(`  [${i}/${ordered.length}] skip (already set): ${user}`);
      continue;
    }

    try {
      const tx = await ad.setReferrer(user, referrer);
      const receipt = await tx.wait();
      okCount++;
      if (i % 10 === 0 || i < 5) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`  [${i}/${ordered.length}] ok user=${user} ref=${referrer} tx=${receipt?.hash} (elapsed ${elapsed}s)`);
      }
    } catch (err: any) {
      failCount++;
      console.error(`  [${i}/${ordered.length}] FAIL user=${user} ref=${referrer}: ${err?.shortMessage || err?.message || err}`);
      // Continue processing remaining users; failures are logged for follow-up
    }
  }

  console.log("=== Seed complete ===");
  console.log(`  ok      : ${okCount}`);
  console.log(`  skipped : ${skipCount}`);
  console.log(`  failed  : ${failCount}`);
  console.log(`  total   : ${ordered.length - START_INDEX}`);

  if (grantedHere) {
    console.log("Revoking STAKING_ROLE from signer...");
    const tx = await ad.revokeRole(STAKING_ROLE, signer.address);
    await tx.wait();
    console.log("  revoked, tx:", tx.hash);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
