import { ethers } from "hardhat";

async function main() {
  const usdt = await ethers.getContractAt("MockUSDT", "0xA1516dB15193675E990B4fAe8401E933Aa0CEE3a");
  const lp = "0x0094F16624E5530Ec525A1d403F0309B1BF93ca8";
  const poolBal = await usdt.balanceOf(lp);
  console.log("USDT in LP:", ethers.formatUnits(poolBal, 18));

  const lpContract = await ethers.getContractAt("LiquidityPool", lp);
  const balances = await lpContract.getBalances();
  console.log("getBalances KAIRO:", ethers.formatUnits(balances[0], 18));
  console.log("getBalances USDT:", ethers.formatUnits(balances[1], 18));
}

main().catch(console.error);
