import { ethers } from "hardhat";

/**
 * Diagnose why AtomicP2p.createBuyOrder / createSellOrder revert on opBNB testnet.
 *
 * Suspected root cause: AtomicP2p.createBuyOrder calls
 *   stakingManager.compoundAllFor(msg.sender)
 * but StakingManager.sol does NOT expose `compoundAllFor(address)` — only
 *   compound(uint256)
 *   compoundFor(address,uint256)
 *
 * The unknown selector will revert the call, which bubbles up and reverts
 * the entire createBuyOrder / createSellOrder / sellToOrder / buyFromOrder /
 * executeTrade transaction.
 */
async function main() {
  const P2P_ADDR = "0xD1ff5759206BA1468C393059d9A5205bB952953F";
  const SM_ADDR = "0x5eADF2F4Ac87EAa2fAA5aBCA74BBab98bC7B843f";
  const USDT_ADDR = "0xE6eab343b44B1D1Ccd8fFbf545a6e3e2425c7a18";

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const p2p = await ethers.getContractAt("AtomicP2p", P2P_ADDR);
  const sm = await ethers.getContractAt("StakingManager", SM_ADDR);

  // ----- 1. confirm wired SM -----
  const wiredSM = await p2p.stakingManager();
  console.log("AtomicP2p.stakingManager :", wiredSM);
  console.log("Expected (SM)            :", SM_ADDR);
  console.log("Match                    :", wiredSM.toLowerCase() === SM_ADDR.toLowerCase());

  // ----- 2. probe whether compoundAllFor(address) selector exists on SM -----
  // We do a raw eth_call with the selector. If selector doesn't exist and there is
  // no fallback function, the call reverts with no data.
  const selector = ethers
    .id("compoundAllFor(address)")
    .slice(0, 10);
  console.log("\ncompoundAllFor(address) selector :", selector);
  const callData =
    selector + ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signer.address]).slice(2);
  try {
    const result = await ethers.provider.call({ to: SM_ADDR, data: callData });
    console.log("SM.compoundAllFor staticCall OK :", result);
  } catch (e: any) {
    console.log("SM.compoundAllFor staticCall REVERTED:");
    console.log("  ", e.shortMessage || e.message || e);
  }

  // ----- 3. try a staticCall on createBuyOrder(0) — should fail with the same revert
  // before hitting the require(usdtAmount > 0) check, IF compoundAllFor is the reverter.
  console.log("\n--- staticCall createBuyOrder(1) (no approval needed for sim) ---");
  try {
    await p2p.createBuyOrder.staticCall(1n);
    console.log("staticCall OK (unexpected)");
  } catch (e: any) {
    console.log("staticCall REVERTED:");
    console.log("  shortMessage :", e.shortMessage);
    console.log("  reason       :", e.reason);
    console.log("  data         :", e.data);
  }

  console.log("\n--- staticCall createSellOrder(1) ---");
  try {
    await p2p.createSellOrder.staticCall(1n);
    console.log("staticCall OK (unexpected)");
  } catch (e: any) {
    console.log("staticCall REVERTED:");
    console.log("  shortMessage :", e.shortMessage);
    console.log("  reason       :", e.reason);
    console.log("  data         :", e.data);
  }

  console.log("\n=== Diagnosis ===");
  console.log(
    "If SM.compoundAllFor REVERTED above, then AtomicP2p.createBuyOrder cannot",
  );
  console.log(
    "succeed because the very first thing it does is call this non-existent function.",
  );
  console.log("\nFix paths:");
  console.log(
    "  A) Patch AtomicP2p to wrap call in try/catch (preferred), recompile, redeploy P2P",
  );
  console.log(
    "  B) Add external `compoundAllFor(address)` to StakingManager + redeploy whole stack",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
