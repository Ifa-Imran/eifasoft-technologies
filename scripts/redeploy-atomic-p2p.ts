import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Redeploy AtomicP2p (with try/catch around compoundAllFor) and re-link.
 *
 * Required because old deployed AtomicP2p calls a non-existent
 * `compoundAllFor(address)` on StakingManager, which reverts every P2P op.
 *
 * Usage: npx hardhat run scripts/redeploy-atomic-p2p.ts --network opbnbTestnet
 */
const DELAY = 3000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitTx(tx: any) {
  const r = await tx.wait();
  await sleep(DELAY);
  return r;
}

async function main() {
  // existing testnet addresses
  const KAIRO = "0x611B2c50E0BCcC99E5632c569431C39983126287";
  const LP = "0xf8BAd518660f515443D58dF0b56C826e111A443f";
  const SM = "0x5eADF2F4Ac87EAa2fAA5aBCA74BBab98bC7B843f";
  const USDT = "0xE6eab343b44B1D1Ccd8fFbf545a6e3e2425c7a18";
  const OLD_P2P = "0xD1ff5759206BA1468C393059d9A5205bB952953F";

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const lp = await ethers.getContractAt("LiquidityPool", LP);
  const DEFAULT_ADMIN_ROLE =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const isAdmin = await lp.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
  console.log("Signer is LP admin :", isAdmin);
  if (!isAdmin) throw new Error("Signer lacks DEFAULT_ADMIN_ROLE on LiquidityPool");

  // 1. Deploy new AtomicP2p
  console.log("\n[1/4] Deploying new AtomicP2p...");
  const P2P = await ethers.getContractFactory("AtomicP2p");
  const p2p = await P2P.deploy(KAIRO, USDT, LP);
  await p2p.waitForDeployment();
  await sleep(DELAY);
  const newP2pAddress = await p2p.getAddress();
  console.log("  New AtomicP2p :", newP2pAddress);

  // 2. Grant P2P_ROLE on LP to new AtomicP2p
  console.log("\n[2/4] Granting P2P_ROLE on LiquidityPool to new AtomicP2p...");
  let tx = await lp.grantP2PRole(newP2pAddress);
  await waitTx(tx);
  const P2P_ROLE = ethers.keccak256(ethers.toUtf8Bytes("P2P_ROLE"));
  const hasRole = await lp.hasRole(P2P_ROLE, newP2pAddress);
  console.log("  New AtomicP2p has P2P_ROLE :", hasRole);

  // 3. setStakingManager on new AtomicP2p
  console.log("\n[3/4] Linking new AtomicP2p -> StakingManager...");
  tx = await p2p.setStakingManager(SM);
  await waitTx(tx);
  console.log("  Done");

  // 4. Smoke test — staticCall createBuyOrder(1) should now revert only on the
  // require(amount > 0) check after the try/catch, OR succeed if amount > 0.
  console.log("\n[4/4] Smoke test staticCall createBuyOrder(1)...");
  try {
    await p2p.createBuyOrder.staticCall(1n);
    console.log("  staticCall OK (would create order with 1 wei USDT)");
  } catch (e: any) {
    const msg = e.shortMessage || e.reason || e.message || String(e);
    if (msg.includes("ERC20") || msg.includes("allowance") || msg.includes("balance")) {
      console.log("  staticCall reverted as expected on transferFrom (no approval):", msg);
      console.log("  >> compoundAllFor try/catch is working (we passed that step)");
    } else {
      console.log("  staticCall reverted:", msg);
      console.log("  data:", e.data);
    }
  }

  // Save deploy record
  const out = {
    deployedAt: new Date().toISOString(),
    network: { chainId: (await ethers.provider.getNetwork()).chainId.toString() },
    oldAtomicP2p: OLD_P2P,
    newAtomicP2p: newP2pAddress,
    txs: {
      grantP2PRole: "see logs",
      setStakingManager: "see logs",
    },
  };
  const outDir = path.join(__dirname, "..", "backups");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `atomic-p2p-redeploy-${stamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("\nWrote:", outPath);

  console.log("\n=============================================");
  console.log("DONE. Update env vars:");
  console.log(`  NEXT_PUBLIC_ATOMIC_P2P=${newP2pAddress}`);
  console.log("=============================================");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
