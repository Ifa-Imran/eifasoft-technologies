import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // v27 MockUSDT address
  const USDT = "0xD0716dCB53833fCb82Ecb838858D44935f8680F3";
  
  // Test wallets to fund
  const recipients = [
    { label: "User1 (0x0971)", addr: "0x0971974c1bb04e5ae9fdfdc96f03c161d9e5593f" },
    { label: "User2 (0x6726)", addr: "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA" },
    { label: "User3 (0x65fb)", addr: "0x65FB5FB2DCf452507264FbED3f73643F7222270A" },
    { label: "User4 (0x2b0a)", addr: "0x2b0a6F7f3C657a43EEd24095e78dBBb3eCd5c68c" },
  ];

  const usdt = await ethers.getContractAt("MockUSDT", USDT);
  const AMOUNT = ethers.parseEther("50000"); // 50,000 USDT each

  for (const r of recipients) {
    console.log(`\nMinting ${ethers.formatEther(AMOUNT)} USDT to ${r.label} (${r.addr})...`);
    const tx = await usdt.mint(r.addr, AMOUNT);
    await tx.wait();
    const bal = await usdt.balanceOf(r.addr);
    console.log(`  Balance: ${ethers.formatEther(bal)} USDT`);
  }

  console.log("\nDone! All test wallets funded.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
