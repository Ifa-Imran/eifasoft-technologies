import { ethers } from "hardhat";

/**
 * Verify the new StakingManager reverts unstake() for migrated stakes.
 *
 * Picks the first seeded user from corrected-seed-data.json, finds their
 * first active stake (which should be migrated), and runs a staticCall on
 * unstake() impersonated as that user. Expected: revert with
 * "StakingManager: Migrated stakes are locked".
 */
async function main() {
  const NEW_SM = "0xDAF8A0211475BD441dBe0e8A8b9284eC4BFc0Ee7";
  const TEST_USER = "0x0245143995ee2a729d4f5391a68726b47db5050f"; // 100 USDT, 10 subs

  const sm = await ethers.getContractAt("StakingManager", NEW_SM);

  const stakes = await sm.getUserStakes(TEST_USER);
  console.log("Stakes for", TEST_USER, ":", stakes.length);

  let firstActive = -1;
  for (let i = 0; i < stakes.length; i++) {
    const s = stakes[i] as any;
    console.log(`  [${i}] amount=${ethers.formatUnits(s.amount, 18)} active=${s.active} isMigrated=${s.isMigrated} tier=${s.tier}`);
    if (s.active && firstActive < 0) firstActive = i;
  }

  if (firstActive < 0) {
    console.log("No active stake found");
    return;
  }

  console.log("\nAttempting staticCall unstake on stake", firstActive, "...");

  // Use eth_call with impersonated 'from'
  const data = sm.interface.encodeFunctionData("unstake", [firstActive]);
  try {
    const result = await ethers.provider.call({
      from: TEST_USER,
      to: NEW_SM,
      data,
    });
    console.log("UNEXPECTED SUCCESS — call did not revert. Result:", result);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.log("REVERT (expected):", msg.slice(0, 300));
    if (msg.includes("Migrated stakes are locked")) {
      console.log("\n[OK] Guard is active. Migrated stakes cannot be unstaked.");
    } else {
      console.log("\n[WARN] Reverted with a different reason. Check the error above.");
    }
  }

  // Also verify previewUnstake returns 0 for migrated stake
  const preview = await sm.previewUnstake(TEST_USER, firstActive);
  console.log("\npreviewUnstake returned:", preview.toString(), preview === 0n ? "(OK, 0 as expected for migrated)" : "(WARN, expected 0)");
}

main().catch((e) => { console.error(e); process.exit(1); });
