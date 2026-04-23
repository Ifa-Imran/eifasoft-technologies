import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // v32 MockUSDT address
  const USDT = "0xc61F4403f4d703d423e9AE5E987c906B6A85c047";
  
  // Test wallets to fund
  const recipients = [
    { label: "User1 (0x65FB)", addr: "0x65FB5FB2DCf452507264FbED3f73643F7222270A" },
    { label: "User2 (0x6726)", addr: "0x6726F92AE08A26a411fAdC5B0bb8f0A28b6Dd7cA" },
    { label: "User3 (0xC718)", addr: "0xC71856D281Df222042435046d29414cd7835DFC3" },
  ];

  const usdt = await ethers.getContractAt("MockUSDT", USDT);
  const AMOUNT = ethers.parseEther("1000000"); // 1,000,000 USDT each

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
