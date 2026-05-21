import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const ad = await ethers.getContractAt(
    "AffiliateDistributor",
    "0x8C7FF618C0Bc7ae9b9fd2828Ba33d977edb99237"
  );

  // Load correct tree
  const raw = fs.readFileSync(
    path.join(__dirname, "../backups/correct-tree.json"),
    "utf8"
  );
  const data = JSON.parse(raw);
  const tree: { user: string; referrer: string }[] = data.users;

  const genesis = (await ad.genesisAccount()).toLowerCase();
  console.log(`Genesis: ${genesis}`);
  console.log(`Total tree entries: ${tree.length}`);

  let correct = 0;
  let mismatch = 0;
  let notSet = 0;
  const mismatches: { user: string; expected: string; actual: string }[] = [];

  // Check in batches to avoid rate limiting
  const BATCH = 20;
  for (let i = 0; i < tree.length; i += BATCH) {
    const batch = tree.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (entry) => {
        const onChainRef = await ad.referrerOf(entry.user);
        return { ...entry, onChainRef: onChainRef.toLowerCase() };
      })
    );

    for (const r of results) {
      const expected = r.referrer.toLowerCase();
      const actual = r.onChainRef;

      if (actual === "0x0000000000000000000000000000000000000000") {
        notSet++;
        mismatches.push({ user: r.user, expected: r.referrer, actual: "NOT_SET" });
      } else if (actual !== expected) {
        // Special case: genesis refers to itself
        if (r.user.toLowerCase() === genesis && actual === genesis) {
          correct++;
          continue;
        }
        mismatch++;
        mismatches.push({ user: r.user, expected: r.referrer, actual: r.onChainRef });
      } else {
        correct++;
      }
    }

    process.stdout.write(`\r  Checked ${Math.min(i + BATCH, tree.length)}/${tree.length}...`);
  }

  console.log(`\n\n=== RESULTS ===`);
  console.log(`  Correct: ${correct}`);
  console.log(`  Mismatch: ${mismatch}`);
  console.log(`  Not set: ${notSet}`);
  console.log(`  Total: ${tree.length}`);

  if (mismatches.length > 0) {
    console.log(`\n=== MISMATCHED ENTRIES ===`);
    for (const m of mismatches) {
      console.log(`  ${m.user}`);
      console.log(`    expected referrer: ${m.expected}`);
      console.log(`    actual referrer:   ${m.actual}`);
    }

    // Save to file for fixing
    const outPath = path.join(__dirname, "../backups/tree-mismatches.json");
    fs.writeFileSync(outPath, JSON.stringify(mismatches, null, 2));
    console.log(`\nSaved ${mismatches.length} mismatches to ${outPath}`);
  }
}

main().catch(console.error);
