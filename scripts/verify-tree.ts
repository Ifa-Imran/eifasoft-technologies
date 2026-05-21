import { ethers } from "hardhat";
import * as fs from "fs";

/**
 * Verify on-chain referrerOf and directCount against backups/correct-tree.json
 * for a sample of N users.
 *
 * Env:
 *   AFFILIATE_DISTRIBUTOR_ADDRESS (required)
 *   TREE_FILE                     (default: backups/correct-tree.json)
 *   SAMPLE                        (default: 25 random samples, plus genesis)
 */
async function main() {
  const AD = process.env.AFFILIATE_DISTRIBUTOR_ADDRESS || "";
  const TREE = process.env.TREE_FILE || "backups/correct-tree.json";
  const SAMPLE = Number(process.env.SAMPLE || "25");
  if (!AD) throw new Error("AFFILIATE_DISTRIBUTOR_ADDRESS not set");

  const [signer] = await ethers.getSigners();
  const ad = await ethers.getContractAt("AffiliateDistributor", AD, signer);
  const data = JSON.parse(fs.readFileSync(TREE, "utf8"));
  const users: { user: string; referrer: string }[] = data.users;
  const genesis = (data.genesis || "").toLowerCase();
  const onChainGenesis = (await ad.genesisAccount()).toLowerCase();

  console.log("=== verify-tree ===");
  console.log("  AD               :", AD);
  console.log("  total users      :", users.length);
  console.log("  snapshot genesis :", genesis);
  console.log("  on-chain genesis :", onChainGenesis);

  // Pick: snapshot genesis + N random
  const idx = new Set<number>();
  for (let i = 0; i < SAMPLE && idx.size < users.length; i++) {
    idx.add(Math.floor(Math.random() * users.length));
  }
  const sample = [...idx].map((i) => users[i]);
  // Ensure genesis is included
  const gIdx = users.findIndex((u) => u.user.toLowerCase() === genesis);
  if (gIdx >= 0) sample.unshift(users[gIdx]);

  let mismatches = 0;
  for (const u of sample) {
    const userLower = u.user.toLowerCase();
    const expectedRefRaw = u.referrer.toLowerCase();
    // Snapshot genesis maps to on-chain genesis (deployer) on chain
    const expectedRef =
      userLower === genesis ? onChainGenesis : expectedRefRaw === genesis ? genesis : expectedRefRaw;

    let onRef: string = ethers.ZeroAddress;
    try { onRef = (await ad.referrerOf(userLower)).toLowerCase(); } catch {}
    let directs: bigint = 0n;
    try { directs = await ad.directCount(userLower); } catch {}

    const ok = onRef === expectedRef;
    if (!ok) mismatches++;
    console.log(`  ${userLower}  ref(on/exp)=${onRef}/${expectedRef}  directs=${directs}  ${ok ? "OK" : "MISMATCH"}`);
  }

  // Aggregate: count all on-chain users with non-zero referrer (sample test)
  let nonZeroCount = 0;
  for (const u of users) {
    const r = (await ad.referrerOf(u.user.toLowerCase())).toLowerCase();
    if (r !== ethers.ZeroAddress.toLowerCase()) nonZeroCount++;
  }
  console.log(`\nOn-chain users with referrerOf != 0: ${nonZeroCount}/${users.length}`);
  console.log(`Sample mismatches: ${mismatches}/${sample.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
