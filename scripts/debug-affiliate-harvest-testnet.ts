import { ethers } from "hardhat";

/**
 * Diagnose why AffiliateDistributor.harvest reverts on opBNB testnet.
 *
 * Expected revert paths (in order of likelihood):
 *   1. AD lacks INCOME_RECORDER_ROLE on StakingManager
 *      (recordIncomeClaim is onlyRole(INCOME_RECORDER_ROLE))
 *   2. SM.affiliateDistributor != deployed AD
 *      (applyCappedHarvest checks msg.sender == affiliateDistributor)
 *   3. AD.stakingManager != deployed SM (broken link, call reverts)
 *   4. AD lacks MINTER_ROLE on KAIROToken (mint at end of harvest reverts)
 *   5. User has no active stake / balance < $10
 */
async function main() {
  const AD_ADDR = "0x530Ade1d4E3E757214E3E2bc0633b973621216F9";
  const SM_ADDR = "0x5eADF2F4Ac87EAa2fAA5aBCA74BBab98bC7B843f";
  const KAIRO_ADDR = "0x611B2c50E0BCcC99E5632c569431C39983126287";
  const LP_ADDR = "0xf8BAd518660f515443D58dF0b56C826e111A443f";
  const DEPLOYER = "0x624D0985D844Cd1DF132723a9d849FE1A34cAf9D";

  const ad = await ethers.getContractAt("AffiliateDistributor", AD_ADDR);
  const sm = await ethers.getContractAt("StakingManager", SM_ADDR);
  const kairo = await ethers.getContractAt("KAIROToken", KAIRO_ADDR);
  const lp = await ethers.getContractAt("LiquidityPool", LP_ADDR);

  const INCOME_RECORDER_ROLE = ethers.keccak256(
    ethers.toUtf8Bytes("INCOME_RECORDER_ROLE"),
  );
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  console.log("=== Address links ===");
  const adSM = await ad.stakingManager();
  const smAD = await sm.affiliateDistributor();
  console.log("AD.stakingManager        :", adSM);
  console.log("expected (SM)            :", SM_ADDR);
  console.log("MATCH                    :", adSM.toLowerCase() === SM_ADDR.toLowerCase());
  console.log();
  console.log("SM.affiliateDistributor  :", smAD);
  console.log("expected (AD)            :", AD_ADDR);
  console.log("MATCH                    :", smAD.toLowerCase() === AD_ADDR.toLowerCase());

  console.log("\n=== Roles ===");
  const adHasIncomeRecorder = await sm.hasRole(INCOME_RECORDER_ROLE, AD_ADDR);
  const adHasMinter = await kairo.hasRole(MINTER_ROLE, AD_ADDR);
  const smHasMinter = await kairo.hasRole(MINTER_ROLE, SM_ADDR);
  console.log("AD has INCOME_RECORDER_ROLE on SM   :", adHasIncomeRecorder);
  console.log("AD has MINTER_ROLE on KAIRO         :", adHasMinter);
  console.log("SM has MINTER_ROLE on KAIRO         :", smHasMinter);

  console.log("\n=== Live price ===");
  try {
    const price = await lp.getLivePrice();
    console.log("LP.getLivePrice          :", ethers.formatUnits(price, 18), "USDT/KAIRO");
  } catch (e: any) {
    console.log("LP.getLivePrice REVERTED :", e.message ?? e);
  }

  console.log("\n=== Deployer income state ===");
  try {
    const all = await ad.getAllIncome(DEPLOYER);
    console.log(
      "Deployer income (direct, team, rank) USD:",
      (all as bigint[]).map((x) => ethers.formatUnits(x, 18)),
    );
  } catch (e: any) {
    console.log("getAllIncome reverted    :", e.message ?? e);
  }
  console.log("Deployer hasActivePosition :", await sm.hasActivePosition(DEPLOYER));

  // Conclusion
  console.log("\n=== Diagnosis ===");
  if (adSM.toLowerCase() !== SM_ADDR.toLowerCase()) {
    console.log("X AD.stakingManager mismatch — call AD.setStakingManager(SM)");
  }
  if (smAD.toLowerCase() !== AD_ADDR.toLowerCase()) {
    console.log("X SM.affiliateDistributor mismatch — call SM.setAffiliateDistributor(AD)");
  }
  if (!adHasIncomeRecorder) {
    console.log("X AD lacks INCOME_RECORDER_ROLE on SM — call SM.setAffiliateDistributor(AD) (also grants the role)");
  }
  if (!adHasMinter) {
    console.log("X AD lacks MINTER_ROLE on KAIRO — call KAIRO.grantRole(MINTER_ROLE, AD)");
  }
  if (
    adSM.toLowerCase() === SM_ADDR.toLowerCase() &&
    smAD.toLowerCase() === AD_ADDR.toLowerCase() &&
    adHasIncomeRecorder &&
    adHasMinter
  ) {
    console.log("OK config looks correct — investigate per-user state (active stake, balance >= $10)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
