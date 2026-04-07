import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const USDT = "0x94Cfa95Ea64b05fE287D79EacD521647612A2b1d";
  const RECIPIENT = "0x0971974c1bb04e5ae9fdfdc96f03c161d9e5593f";
  const AMOUNT = ethers.parseEther("10000"); // 10,000 USDT

  const usdt = await ethers.getContractAt("MockUSDT", USDT);
  
  const balBefore = await usdt.balanceOf(RECIPIENT);
  console.log("Recipient balance before:", ethers.formatEther(balBefore), "USDT");

  const tx = await usdt.transfer(RECIPIENT, AMOUNT);
  await tx.wait();
  
  const balAfter = await usdt.balanceOf(RECIPIENT);
  console.log("Recipient balance after:", ethers.formatEther(balAfter), "USDT");
  console.log("Sent", ethers.formatEther(AMOUNT), "USDT to", RECIPIENT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
