import { ethers } from "hardhat";

/**
 * Fix: grant MINTER_ROLE to AffiliateDistributor on KAIROToken (testnet).
 * Without it, AffiliateDistributor.harvest() reverts at the final
 * kairoToken.mint(msg.sender, kairoAmount) call.
 *
 * Must be run by a wallet that holds DEFAULT_ADMIN_ROLE on KAIROToken
 * (the deployer set in DEPLOYER_PRIVATE_KEY).
 */
async function main() {
  const AD_ADDR = "0x530Ade1d4E3E757214E3E2bc0633b973621216F9";
  const KAIRO_ADDR = "0x611B2c50E0BCcC99E5632c569431C39983126287";

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const kairo = await ethers.getContractAt("KAIROToken", KAIRO_ADDR);
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const DEFAULT_ADMIN_ROLE =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  const isAdmin = await kairo.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  console.log("Signer is KAIRO admin :", isAdmin);
  if (!isAdmin) {
    throw new Error("Signer does not hold DEFAULT_ADMIN_ROLE on KAIROToken");
  }

  const before = await kairo.hasRole(MINTER_ROLE, AD_ADDR);
  console.log("AD has MINTER_ROLE before :", before);
  if (before) {
    console.log("Already granted, nothing to do.");
    return;
  }

  console.log("Granting MINTER_ROLE to AffiliateDistributor...");
  const tx = await kairo.grantRole(MINTER_ROLE, AD_ADDR);
  console.log("tx :", tx.hash);
  const rcpt = await tx.wait();
  console.log("Confirmed in block :", rcpt?.blockNumber);

  const after = await kairo.hasRole(MINTER_ROLE, AD_ADDR);
  console.log("AD has MINTER_ROLE after  :", after);
  if (!after) {
    throw new Error("Role grant did not take effect");
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
