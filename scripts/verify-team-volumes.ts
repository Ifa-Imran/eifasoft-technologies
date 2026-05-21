import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Reads back personalVolume + teamVolume + rankLevel for the top-N upline
 * candidates in the snapshot, and compares against expected values.
 *
 * Env:
 *   AFFILIATE_DISTRIBUTOR_ADDRESS (required)
 *   SNAPSHOT_FILE                 (default: backups/snapshot.json)
 *   TOP_N                         (default: 10) — how many highest-teamVolume
 *                                  users to read back
 */
async function main() {
  const AD = process.env.AFFILIATE_DISTRIBUTOR_ADDRESS || "";
  const SNAPSHOT_FILE = process.env.SNAPSHOT_FILE || "backups/snapshot.json";
  const TOP_N = Number(process.env.TOP_N || "10");

  if (!AD) throw new Error("AFFILIATE_DISTRIBUTOR_ADDRESS not set");

  const [signer] = await ethers.getSigners();
  const net = await signer.provider.getNetwork();
  console.log("=== verify-team-volumes ===");
  console.log("  signer               :", signer.address);
  console.log("  network              :", net.name, `(chainId ${net.chainId})`);
  console.log("  AffiliateDistributor :", AD);

  const ad = await ethers.getContractAt("AffiliateDistributor", AD, signer);

  const raw = fs.readFileSync(path.resolve(SNAPSHOT_FILE), "utf-8");
  const snap = JSON.parse(raw);
  const users: any[] = snap.users || [];

  // Sort by expected teamVolume (string -> bigint)
  const ranked = users
    .map((u: any) => ({
      addr: (u.user || u.address || "").toLowerCase(),
      expectedPersonal: BigInt(u.affiliate?.personalVolume || "0"),
      expectedTeam: BigInt(u.affiliate?.teamVolume || "0"),
      expectedRank: Number(u.affiliate?.rankLevel || 0),
    }))
    .filter((u) => /^0x[0-9a-f]{40}$/.test(u.addr))
    .sort((a, b) => (a.expectedTeam < b.expectedTeam ? 1 : a.expectedTeam > b.expectedTeam ? -1 : 0))
    .slice(0, TOP_N);

  console.log(`\nTop ${TOP_N} users by expected teamVolume:`);
  console.log(
    "  ".padEnd(2) +
      "address".padEnd(44) +
      "personal(on/exp)".padEnd(32) +
      "team(on/exp)".padEnd(40) +
      "rank(on/exp)"
  );

  let mismatches = 0;
  for (const u of ranked) {
    const onPersonal: bigint = await ad.personalVolume(u.addr);
    const onTeam: bigint = await ad.teamVolume(u.addr);
    const onRank: bigint = await ad.userRankLevel(u.addr);

    const fmt = (v: bigint) => `${(Number(v) / 1e18).toFixed(2)}`;
    const personalStr = `${fmt(onPersonal)}/${fmt(u.expectedPersonal)}`;
    const teamStr = `${fmt(onTeam)}/${fmt(u.expectedTeam)}`;
    const rankStr = `${onRank}/${u.expectedRank}`;

    const match =
      onPersonal === u.expectedPersonal &&
      onTeam === u.expectedTeam &&
      Number(onRank) === u.expectedRank;
    if (!match) mismatches++;

    console.log(
      "  " +
        u.addr.padEnd(44) +
        personalStr.padEnd(32) +
        teamStr.padEnd(40) +
        rankStr +
        (match ? "  OK" : "  MISMATCH")
    );
  }

  console.log(`\nMismatches: ${mismatches}/${ranked.length}`);

  // Also compute aggregates across snapshot
  let sumPersonalOnchain = 0n;
  let sumTeamOnchain = 0n;
  let sumPersonalExpected = 0n;
  let sumTeamExpected = 0n;
  let sample = 0;
  for (const u of users) {
    const addr = (u.user || u.address || "").toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(addr)) continue;
    const ePersonal = BigInt(u.affiliate?.personalVolume || "0");
    const eTeam = BigInt(u.affiliate?.teamVolume || "0");
    sumPersonalExpected += ePersonal;
    sumTeamExpected += eTeam;
    if (ePersonal === 0n && eTeam === 0n) continue;
    sample++;
    const onP: bigint = await ad.personalVolume(addr);
    const onT: bigint = await ad.teamVolume(addr);
    sumPersonalOnchain += onP;
    sumTeamOnchain += onT;
  }

  const fmt = (v: bigint) => `${(Number(v) / 1e18).toFixed(2)}`;
  console.log(`\nAggregate over ${sample} users with non-zero expected volume:`);
  console.log(`  sumPersonal (onchain / expected): ${fmt(sumPersonalOnchain)} / ${fmt(sumPersonalExpected)}`);
  console.log(`  sumTeam     (onchain / expected): ${fmt(sumTeamOnchain)} / ${fmt(sumTeamExpected)}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
