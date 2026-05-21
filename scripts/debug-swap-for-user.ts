import { ethers } from "hardhat";
import "dotenv/config";

/**
 * Debug why swapKAIROForUSDT reverts for a specific user.
 *
 * Reads the user's private key from process.env.USER_PRIVATE_KEY
 * (NEVER hardcode keys — see .env).
 *
 * Run:
 *   npx hardhat run scripts/debug-swap-for-user.ts --network opbnbTestnet
 *
 * It walks every gating condition in LiquidityPool.swapKAIROForUSDT in the
 * same order the contract evaluates them, then does a callStatic / estimateGas
 * to surface the EXACT revert reason the frontend pre-simulation is hitting.
 *
 * Gating order (from contracts/LiquidityPool.sol):
 *   A. stakingManager.compoundAllFor(msg.sender)        // L188-189
 *   B. require(kairoAmount > 0)                          // L192
 *   C. require(recipient != address(0))                  // L193
 *   D. msg.sender == deployer  =>  revert                // L196-199
 *   E. usdtOut >= minUSDTOut                             // L210 (slippage)
 *   F. usdtOut <= usdtToken.balanceOf(LP)                // L214 (liquidity)
 *   G. kairoToken.transferFrom(msg.sender, LP, amount)   // L217 (allowance/balance)
 *   H. kairoToken.burn(amount)                           // L218
 */

// ----- Latest opBNB testnet deployment (chainId 5611) -----
const KAIRO_ADDR    = "0x3332Bdf7d4eE96CA9384d46865B4A6edd9D5ae9B";
const LP_ADDR       = "0x2093d2d57E5E9E3ADd7DD85d2963a5fdc1523530";
const SM_ADDR       = "0x44955B9fEc0EB3d7376115ffb4F09998d2264B1d";
const USDT_ADDR     = "0xf664ABe7D5fc28Df9602CB9c54578fE7563e193f";

const SLIPPAGE_BPS = 50n;                  // 0.5%
const SWAP_AMOUNT_KAIRO = ethers.parseUnits("3.0", 18); // < user balance (3.42)

function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

async function main() {
  const pk = process.env.USER_PRIVATE_KEY;
  if (!pk) throw new Error("Set USER_PRIVATE_KEY in .env");

  const [hardhatSigner] = await ethers.getSigners();
  const provider = hardhatSigner.provider;
  if (!provider) throw new Error("No provider");

  const user = new ethers.Wallet(pk, provider);
  console.log("=== User ===");
  console.log("Address :", user.address);
  console.log("Network :", (await provider.getNetwork()).chainId.toString());
  console.log();

  const kairo = await ethers.getContractAt("KAIROToken",    KAIRO_ADDR, user);
  const lp    = await ethers.getContractAt("LiquidityPool", LP_ADDR,    user);
  const sm    = await ethers.getContractAt("StakingManager", SM_ADDR,   user);
  const usdt  = await ethers.getContractAt("MockUSDT",      USDT_ADDR,  user);

  // ---- Balances & basic state ----
  console.log("=== Balances ===");
  const userKairo  = await kairo.balanceOf(user.address);
  const userBnb    = await provider.getBalance(user.address);
  const lpUsdt     = await usdt.balanceOf(LP_ADDR);
  const lpKairo    = await kairo.balanceOf(LP_ADDR);
  console.log("User KAIRO       :", ethers.formatUnits(userKairo, 18));
  console.log("User tBNB        :", ethers.formatUnits(userBnb, 18));
  console.log("LP   USDT        :", ethers.formatUnits(lpUsdt, 18));
  console.log("LP   KAIRO       :", ethers.formatUnits(lpKairo, 18));

  // ---- Allowance ----
  console.log("\n=== Allowance (G) ===");
  const allowance = await kairo.allowance(user.address, LP_ADDR);
  console.log("KAIRO allowance to LP :", ethers.formatUnits(allowance, 18));
  const needsApproval = allowance < SWAP_AMOUNT_KAIRO;
  console.log("Sufficient for swap   :", !needsApproval);

  // ---- Deployer block (D) ----
  console.log("\n=== Deployer block (D) ===");
  const deployer = await lp.deployer();
  console.log("LP.deployer            :", deployer);
  const isDeployer = deployer.toLowerCase() === user.address.toLowerCase();
  console.log("user == deployer ?     :", isDeployer);

  // ---- Pricing & slippage (E,F) ----
  console.log("\n=== Price + output (E,F) ===");
  const price = await lp.getCurrentPrice();
  console.log("getCurrentPrice  (1e18):", price.toString());
  console.log("getCurrentPrice  fmt   :", ethers.formatUnits(price, 18), "USDT/KAIRO");
  const PRICE_PRECISION = 10n ** 18n;
  const SWAP_FEE_PERCENT = 10n; // matches contract
  const grossUsdt = (SWAP_AMOUNT_KAIRO * price) / PRICE_PRECISION;
  const fee       = (grossUsdt * SWAP_FEE_PERCENT) / 100n;
  const netUsdt   = grossUsdt - fee;
  const minUsdt   = (netUsdt * (10000n - SLIPPAGE_BPS)) / 10000n;
  console.log("amount in       :", ethers.formatUnits(SWAP_AMOUNT_KAIRO, 18), "KAIRO");
  console.log("gross USDT out  :", ethers.formatUnits(grossUsdt, 18));
  console.log("fee 10%         :", ethers.formatUnits(fee, 18));
  console.log("net USDT out    :", ethers.formatUnits(netUsdt, 18));
  console.log("minOut (0.5%)   :", ethers.formatUnits(minUsdt, 18));
  console.log("LP USDT >= net? :", lpUsdt >= netUsdt);

  // ---- Auto-compound revert (A) ----
  console.log("\n=== Auto-compound (A) — stakingManager.compoundAllFor(user) ===");
  const linkedSM = await lp.stakingManager();
  console.log("LP.stakingManager      :", linkedSM, "(expected", SM_ADDR + ")");
  if (linkedSM !== ethers.ZeroAddress) {
    try {
      const hasPos = await sm.hasActivePosition(user.address);
      console.log("user hasActivePosition :", hasPos);
    } catch (e: any) {
      console.log("hasActivePosition revert:", e.shortMessage ?? e.message);
    }
    try {
      // staticCall reproduces the exact revert without sending a tx
      await sm.compoundAllFor.staticCall(user.address);
      console.log("compoundAllFor staticCall: OK (no revert)");
    } catch (e: any) {
      console.log("compoundAllFor REVERTED :", e.shortMessage ?? e.reason ?? e.message);
      console.log("  → THIS is your blocker. The swap can never proceed until");
      console.log("    StakingManager.compoundAllFor(user) succeeds.");
    }
  } else {
    console.log("LP.stakingManager not set — skipping (A)");
  }

  // ---- Final: simulate the actual swap ----
  console.log("\n=== swapKAIROForUSDT staticCall (full path) ===");
  if (needsApproval) {
    console.log("⚠ Not enough allowance. Auto-approving for the simulation...");
    const tx = await kairo.approve(LP_ADDR, ethers.MaxUint256);
    console.log("approve tx:", tx.hash);
    await tx.wait();
    console.log("approve confirmed");
  }
  try {
    const out = await lp.swapKAIROForUSDT.staticCall(
      SWAP_AMOUNT_KAIRO,
      minUsdt,
      user.address,
    );
    console.log("staticCall OK — would receive:", ethers.formatUnits(out, 18), "USDT");
    console.log("→ The contract path is fine. If the UI still says 'Swap blocked',");
    console.log("  it is a wallet/RPC issue: re-check window.ethereum chain id and");
    console.log("  that the UI signer matches", shortAddr(user.address));
  } catch (e: any) {
    const reason =
      e.reason ??
      e.shortMessage ??
      e.errorName ??
      e.data ??
      e.message;
    console.log("staticCall REVERTED:", reason);

    // Map the revert to the gating condition
    const r = String(reason);
    if (r.includes("Deployer cannot swap"))         console.log("→ Condition (D): user IS deployer");
    else if (r.includes("USDT to KAIRO swaps disabled")) console.log("→ wrong direction — USDT→KAIRO is permanently disabled");
    else if (r.includes("Slippage too high"))       console.log("→ Condition (E): slippage. Bump slippage or refresh price.");
    else if (r.includes("Insufficient USDT liquidity")) console.log("→ Condition (F): pool has no USDT. Top up LP.");
    else if (r.includes("Invalid KAIRO amount"))    console.log("→ Condition (B): amount is 0");
    else if (r.includes("Invalid recipient"))       console.log("→ Condition (C): recipient is 0x0");
    else if (r.includes("ERC20InsufficientAllowance")) console.log("→ Condition (G): KAIRO allowance < amount");
    else if (r.includes("ERC20InsufficientBalance")) console.log("→ Condition (G/H): user KAIRO balance too low");
    else                                            console.log("→ Condition (A): likely StakingManager.compoundAllFor revert (see block above)");
  }

  console.log("\n=== gas estimate (final sanity) ===");
  try {
    const gas = await lp.swapKAIROForUSDT.estimateGas(
      SWAP_AMOUNT_KAIRO,
      minUsdt,
      user.address,
    );
    console.log("estimateGas:", gas.toString());
  } catch (e: any) {
    console.log("estimateGas REVERTED:", e.shortMessage ?? e.reason ?? e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
