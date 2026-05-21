import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  const tx = "0x9a94102148550806502041068d2285b2aa79463a1b60bc4e262bc5c7f6d4ad43";
  const receipt = await provider.getTransactionReceipt(tx);
  if (!receipt) {
    console.log("Receipt not found");
    return;
  }
  console.log("Seeding tx block:", receipt.blockNumber);
  console.log("Seeding tx block hash:", receipt.blockHash);
}

main().catch(console.error);
