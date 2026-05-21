import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  const ad = "0xeFc8271Abe8a1EADd5c4D7c9903C0D092C2bEF86";
  const current = await provider.getBlockNumber();
  console.log("Current block:", current);

  // Binary search for creation block
  let lo = 0, hi = current;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const c = await provider.getCode(ad, mid);
    if (c.length > 2) { hi = mid; } else { lo = mid + 1; }
  }
  console.log("AffiliateDistributor creation block:", lo);

  // Check all testnet contracts
  const contracts = [
    ["KAIROToken", "0x611B2c50E0BCcC99E5632c569431C39983126287"],
    ["LiquidityPool", "0xf8BAd518660f515443D58dF0b56C826e111A443f"],
    ["StakingManager", "0xf664bb81902E507424995fDAe182e1dA9019A904"],
    ["CMS", "0x995B0545677150d8d5Fa6374730FcB4cD400ba88"],
    ["AtomicP2p", "0xD1ff5759206BA1468C393059d9A5205bB952953F"],
    ["MockUSDT", "0xE6eab343b44B1D1Ccd8fFbf545a6e3e2425c7a18"],
  ];

  for (const [name, addr] of contracts) {
    let l = 0, h = current;
    while (l < h) {
      const m = Math.floor((l + h) / 2);
      const c = await provider.getCode(addr, m);
      if (c.length > 2) { h = m; } else { l = m + 1; }
    }
    console.log(`${name} creation block:`, l);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
