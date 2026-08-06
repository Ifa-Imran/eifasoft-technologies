import { ethers } from "ethers";
import "dotenv/config";

const RPC = "https://opbnb-mainnet-rpc.bnbchain.org";
const STAKING = "0x21c22de855e87B2124A50d76f31E79152C977090";
const WALLET = "0xD3B8D78c447c64ebB1D9815aBB1019Ea2CBa74Fb";

const ABI = [
  "function getUserStakes(address _user) view returns (tuple(uint256 amount, uint256 originalAmount, uint256 startTime, uint256 lastCompoundTime, uint256 harvestedRewards, uint256 totalEarned, uint256 compoundEarned, bool active, uint8 tier, bool capped)[])",
  "function userStakes(address, uint256) view returns (uint256 amount, uint256 originalAmount, uint256 startTime, uint256 lastCompoundTime, uint256 harvestedRewards, uint256 totalEarned, uint256 compoundEarned, bool active, uint8 tier, bool capped)",
  "function getUserStakeCount(address _user) view returns (uint256)",
];

async function main() {
  const p = new ethers.JsonRpcProvider(RPC);
  const c = new ethers.Contract(STAKING, ABI, p);

  const count = await c.getUserStakeCount(WALLET);
  console.log(`Stake count: ${count}\n`);

  console.log("=== userStakes(addr, 1) raw values ===");
  const s = await c.userStakes(WALLET, 1);
  console.log("amount:", s.amount.toString());
  console.log("originalAmount:", s.originalAmount.toString());
  console.log("startTime:", s.startTime.toString());
  console.log("lastCompoundTime:", s.lastCompoundTime.toString());
  console.log("harvestedRewards:", s.harvestedRewards.toString());
  console.log("totalEarned:", s.totalEarned.toString());
  console.log("compoundEarned:", s.compoundEarned.toString());
  console.log("active:", s.active);
  console.log("tier:", s.tier);

  console.log("\n=== getUserStakes(addr)[1] raw values ===");
  const all = await c.getUserStakes(WALLET);
  console.log("Total returned:", all.length);
  const g = all[1];
  console.log("amount:", g.amount.toString());
  console.log("originalAmount:", g.originalAmount.toString());
  console.log("startTime:", g.startTime.toString());
  console.log("lastCompoundTime:", g.lastCompoundTime.toString());
  console.log("harvestedRewards:", g.harvestedRewards.toString());
  console.log("totalEarned:", g.totalEarned.toString());
  console.log("compoundEarned:", g.compoundEarned.toString());
  console.log("active:", g.active);
  console.log("tier:", g.tier);

  // Also try raw eth_call to see hex
  const iface = new ethers.Interface(ABI);
  const calldata = iface.encodeFunctionData("getUserStakes", [WALLET]);
  const rawResult = await p.call({ to: STAKING, data: calldata });
  console.log("\n=== Raw getUserStakes hex — word by word ===");
  const hex = rawResult.slice(2); // remove 0x
  for (let i = 0; i < hex.length; i += 64) {
    const word = hex.slice(i, i + 64);
    const dec = BigInt('0x' + word);
    console.log(`  Word ${String(i/64).padStart(2)}: ${word}  = ${dec}`);
  }
}

main().catch(console.error);
