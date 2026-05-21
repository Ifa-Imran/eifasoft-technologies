import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Redeploy AffiliateDistributor on testnet and seed the FULL referrer tree
 * from `correct-tree.json` (re-queried from mainnet).
 *
 * Approach:
 *   1. Deploy new AD with deployer as admin
 *   2. AD.setStakingManager(deployer)            → gives deployer STAKING_ROLE
 *   3. setReferrer(genesis, deployer)            → first call seeds genesis
 *   4. BFS through tree: setReferrer(child, parent) layer by layer
 *   5. AD.setStakingManager(realSM)              → revokes deployer, grants realSM
 *   6. realSM.setAffiliateDistributor(newAD)
 *
 * Run:
 *   npx hardhat run scripts/redeploy-affiliate-and-seed.ts --network opbnbTestnet
 */

const EXISTING = {
  kairoToken:    "0x611B2c50E0BCcC99E5632c569431C39983126287",
  liquidityPool: "0xf8BAd518660f515443D58dF0b56C826e111A443f",
  stakingManager:"0x5eADF2F4Ac87EAa2fAA5aBCA74BBab98bC7B843f",
  systemWallet:  "0x624D0985D844Cd1DF132723a9d849FE1A34cAf9D",
};

const TREE_FILE = path.join(__dirname, "..", "backups", "correct-tree.json");
const ZERO = ethers.ZeroAddress.toLowerCase();
const TX_DELAY = 200; // ms between sequential txs

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface TreeUser { user: string; referrer: string; }

function buildBfsLayers(users: TreeUser[], genesis: string): string[][] {
  const refOf: Record<string, string> = {};
  for (const u of users) refOf[u.user] = u.referrer;

  const userSet = new Set(users.map(u => u.user));
  const seeded = new Set<string>([genesis]);
  const layers: string[][] = [[genesis]];

  // Build: each layer contains users whose referrer is in `seeded`
  let progress = true;
  while (progress) {
    progress = false;
    const nextLayer: string[] = [];
    for (const u of users) {
      if (seeded.has(u.user)) continue;
      const ref = u.referrer;
      if (ref === ZERO || ref === "ERROR") continue;
      if (ref === u.user) continue;       // skip genesis-self entries (already in layer 0)
      if (seeded.has(ref)) {
        nextLayer.push(u.user);
      }
    }
    if (nextLayer.length > 0) {
      for (const u of nextLayer) seeded.add(u);
      layers.push(nextLayer);
      progress = true;
    }
  }

  // Report stragglers
  const stragglers = users.filter(u => !seeded.has(u.user) && u.user !== genesis);
  if (stragglers.length > 0) {
    console.warn(`  WARNING: ${stragglers.length} users could not be reached from genesis:`);
    for (const s of stragglers.slice(0, 10)) {
      console.warn(`    ${s.user} -> ref=${s.referrer} ${userSet.has(s.referrer) ? "(in set)" : "(NOT in set)"}`);
    }
  }

  return layers;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("=== Redeploy AffiliateDistributor + Seed Tree ===");
  console.log("Deployer:", deployer.address);
  console.log("Network :", network.name, `(${network.chainId})`);

  const tree = JSON.parse(fs.readFileSync(TREE_FILE, "utf8"));
  const treeUsers: TreeUser[] = tree.users || [];
  const genesis: string = tree.genesis;
  console.log("Tree users:", treeUsers.length, "Genesis:", genesis);

  // ── Build BFS layers ──
  const layers = buildBfsLayers(treeUsers, genesis);
  const seedable = layers.flat().length;
  console.log(`Layers: ${layers.length}, Seedable users (incl genesis): ${seedable}`);
  for (let i = 0; i < layers.length; i++) {
    console.log(`  Layer ${i}: ${layers[i].length} users`);
  }

  // ── Deploy new AD (testnet rank interval = 15 minutes) ──
  console.log("\n[1/6] Deploying new AffiliateDistributor...");
  const RANK_INTERVAL_TESTNET = 15 * 60;
  const ADFactory = await ethers.getContractFactory("AffiliateDistributor");
  const ad = await ADFactory.deploy(
    EXISTING.kairoToken,
    EXISTING.liquidityPool,
    deployer.address,
    EXISTING.systemWallet,
    RANK_INTERVAL_TESTNET
  );
  await ad.waitForDeployment();
  await sleep(2000);
  const adAddr = await ad.getAddress();
  console.log("  New AD:", adAddr);

  // ── Grant STAKING_ROLE to deployer (via setStakingManager(deployer)) ──
  console.log("\n[2/6] AD.setStakingManager(deployer) — temp grant...");
  const t1 = await ad.setStakingManager(deployer.address);
  await t1.wait();
  await sleep(500);
  console.log("  ✓ Deployer has STAKING_ROLE");

  // ── Seed genesis (layer 0) ──
  console.log("\n[3/6] Seeding genesis...");
  const genesisTx = await ad.setReferrer(genesis, deployer.address);
  await genesisTx.wait();
  await sleep(TX_DELAY);
  console.log(`  ✓ Genesis ${genesis} set`);

  // ── Seed remaining layers ──
  console.log("\n[4/6] Seeding remaining tree...");
  const refOf: Record<string, string> = {};
  for (const u of treeUsers) refOf[u.user] = u.referrer;

  let totalSet = 1;
  let totalLayers = layers.length;
  for (let layerIdx = 1; layerIdx < totalLayers; layerIdx++) {
    const layer = layers[layerIdx];
    console.log(`\n  Layer ${layerIdx}/${totalLayers - 1}: ${layer.length} users`);
    for (let i = 0; i < layer.length; i++) {
      const user = layer[i];
      const ref = refOf[user];
      try {
        const tx = await ad.setReferrer(user, ref);
        await tx.wait();
        totalSet++;
        if ((i + 1) % 20 === 0 || i === layer.length - 1) {
          console.log(`    [${i + 1}/${layer.length}] last: ${user} -> ${ref} (${tx.hash.slice(0, 10)}...)`);
        }
      } catch (err: any) {
        console.error(`    FAIL ${user} -> ${ref}: ${err?.message?.slice(0, 100)}`);
        throw err;
      }
      await sleep(TX_DELAY);
    }
  }
  console.log(`\n  Total seeded: ${totalSet}/${seedable}`);

  // ── Hand STAKING_ROLE to real SM ──
  console.log("\n[5/6] AD.setStakingManager(realSM) — revoke deployer, grant SM...");
  const t2 = await ad.setStakingManager(EXISTING.stakingManager);
  await t2.wait();
  await sleep(500);
  console.log("  ✓ Real SM now has STAKING_ROLE");

  // ── Wire SM to new AD ──
  console.log("\n[6/6] StakingManager.setAffiliateDistributor(newAD)...");
  const sm = await ethers.getContractAt("StakingManager", EXISTING.stakingManager);
  const t3 = await sm.setAffiliateDistributor(adAddr);
  await t3.wait();
  console.log("  ✓ SM points at new AD");

  // ── Verify ──
  const sampleUser = layers[1] && layers[1][0];
  if (sampleUser) {
    const onChainRef = await ad.referrerOf(sampleUser);
    console.log(`\nVerify: referrerOf(${sampleUser}) = ${onChainRef}`);
  }
  const allReg = await ad.getAllRegistered();
  console.log(`getAllRegistered length: ${allReg.length}`);

  // ── Save ──
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(__dirname, "..", "backups", `ad-redeploy-${network.chainId}-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    newAffiliateDistributor: adAddr,
    seededUsers: totalSet,
    genesis,
    network: network.chainId.toString(),
  }, null, 2));
  console.log(`\nSaved: ${outPath}`);

  console.log("\n=== DONE ===");
  console.log(`NEW AFFILIATE_DISTRIBUTOR: ${adAddr}`);
  console.log("Update NEXT_PUBLIC_AFFILIATE_DISTRIBUTOR in frontend/.env, .env.local, and docker-compose.testnet-dev.yml");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
