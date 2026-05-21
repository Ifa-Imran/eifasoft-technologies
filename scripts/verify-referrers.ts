import { ethers } from "hardhat";

async function main() {
  const ad = await ethers.getContractAt(
    "AffiliateDistributor",
    "0xeFc8271Abe8a1EADd5c4D7c9903C0D092C2bEF86"
  );
  const samples = [
    "0xc33a68ed38fbac69293d19016d12a1a58277710d",
    "0x039e9fe7bf78737d9797702bd52df19b198074bd",
    "0xeab7f78e37bf677a8124b2c96c29bfe3ee3ddb81",
    "0xf23edf86adc32ea69717115a098384c41c71f15a",
  ];
  for (const u of samples) {
    const r = await ad.referrerOf(u);
    console.log(u, "->", r);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
