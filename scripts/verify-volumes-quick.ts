import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const ad = await ethers.getContractAt(
    "AffiliateDistributor",
    "0x8C7FF618C0Bc7ae9b9fd2828Ba33d977edb99237"
  );

  // Load corrected data
  const raw = fs.readFileSync(
    path.join(__dirname, "../backups/corrected-seed-data.json"),
    "utf8"
  );
  const data = JSON.parse(raw);
  const eligible = data.users.filter((u: any) => parseFloat(u.totalPrincipalUsdt) > 0);

  // Sample check: first 5, last 5, and a few in the middle
  const indices = [0, 1, 2, 3, 4, 130, 131, 132, 260, 261, 262, 263].filter(
    (i) => i < eligible.length
  );

  console.log(`Checking ${indices.length} users from ${eligible.length} total...`);
  let mismatches = 0;

  for (const i of indices) {
    const u = eligible[i];
    const expected = parseFloat(u.totalPrincipalUsdt);
    const pv = await ad.personalVolume(u.user);
    const actual = parseFloat(ethers.formatUnits(pv, 18));
    const match = Math.abs(actual - expected) < 0.01;
    console.log(
      `  [${i}] ${u.user}  expected=${expected}  on-chain=${actual}  ${match ? "OK" : "MISMATCH"}`
    );
    if (!match) mismatches++;
  }

  // Deep check for specific wallet
  const wallet = "0xb840Aef79cDA7bef20F80970909924bCd6C497c0";
  console.log(`\n=== Deep check for ${wallet} ===`);
  const wPV = await ad.personalVolume(wallet);
  const wTV = await ad.getTeamVolume(wallet);
  const wRef = await ad.referrerOf(wallet);
  const wDirects = await ad.getDirectReferrals(wallet);
  console.log(`  personalVolume: $${parseFloat(ethers.formatUnits(wPV, 18)).toFixed(2)}`);
  console.log(`  teamVolume (getTeamVolume): $${parseFloat(ethers.formatUnits(wTV, 18)).toFixed(2)}`);
  console.log(`  teamVolume mapping: $${parseFloat(ethers.formatUnits(await ad.teamVolume(wallet), 18)).toFixed(2)}`);
  console.log(`  referrerOf: ${wRef}`);
  console.log(`  directReferrals count: ${wDirects.length}`);
  if (wDirects.length > 0) {
    console.log(`  direct referrals:`);
    for (const d of wDirects) {
      const dPV = await ad.personalVolume(d);
      const dTV = await ad.getTeamVolume(d);
      const dDirects = await ad.getDirectReferrals(d);
      console.log(`    ${d}  pv=$${parseFloat(ethers.formatUnits(dPV, 18)).toFixed(2)}  tv=$${parseFloat(ethers.formatUnits(dTV, 18)).toFixed(2)}  directs=${dDirects.length}`);
    }
  }

  // Check the 3 missing referrals - should have 0xb840... as referrer
  const expectedReferrals = [
    "0x1fa04b000a733343441c42ecc337e4c3dc01ecb1",
    "0xa024af0104cee7b2368c51f46535bfa9de226e36",
    "0xcce25f9953a8226722cd87c834fbb1a1e448a77f",
  ];
  console.log(`\n=== Checking 3 users that SHOULD have ${wallet} as referrer ===`);
  for (const u of expectedReferrals) {
    const ref = await ad.referrerOf(u);
    const pv = await ad.personalVolume(u);
    const directs = await ad.getDirectReferrals(u);
    console.log(`  ${u}`);
    console.log(`    referrerOf: ${ref}`);
    console.log(`    personalVolume: $${parseFloat(ethers.formatUnits(pv, 18)).toFixed(2)}`);
    console.log(`    directReferrals: ${directs.length}`);
    console.log(`    CORRECT referrer? ${ref.toLowerCase() === wallet.toLowerCase() ? 'YES' : 'NO - actually points to ' + ref}`);
  }

  console.log(`\n${mismatches === 0 ? "ALL CHECKED OK" : `${mismatches} MISMATCHES FOUND`}`);
}

main().catch(console.error);
