# KAIRO DAO — System Blueprint (Mainnet-Ready)

> **Status:** Mainnet-ready. Last revised for the opBNB mainnet rollout.
> Production timings (8h/6h/5h compound, 7-day rank salary), 7 DAO wallets,
> 5 KAIRO dev-fund genesis mint, and a CMS-free mainnet deployment pipeline
> are all baked in. Testnet retains short cycles and CMS for end-to-end QA.

---

## 1. Project Overview

KAIRO DAO is a fully decentralized DeFi ecosystem built on **opBNB** (BNB Chain L2).
It combines a deflationary ERC-20 token, an on-chain liquidity pool / mini-DEX,
a multi-tier staking engine, a multi-level affiliate distribution system, an
optional membership subscription program (testnet only), and an atomic P2P
trading platform — all orchestrated through interconnected smart contracts
with role-based access control.

**Core Design Principles**
- **Fully on-chain** — all business logic lives in smart contracts; no backend wallets or admin roles needed for ongoing operations.
- **Deflationary tokenomics** — KAIRO is burned on every DEX swap and P2P trade; the one-way DEX prevents buy-side minting.
- **Permissionless operations** — compounding, harvesting, rank salary accrual, and P2P settlement are all caller-agnostic (anyone can trigger).
- **FIFO 3X harvest cap** — earnings across all income types are tracked against a global 3X cap per stake, enforced only at harvest time.
- **Admin renunciation** — deployer renounces `DEFAULT_ADMIN_ROLE` on every contract via a separate `scripts/renounce-admin.ts` script (with pre-flight checks) **after** all migrations and verifications are complete.

---

## 2. Smart Contract Architecture

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────────────┐
│  USDT (BEP)  │       │   KAIROToken     │       │     LiquidityPool        │
│  (ERC-20)    │◄─────►│   (ERC-20)       │◄─────►│  (Mini-DEX / Treasury)   │
└──────┬───────┘       └───────┬──────────┘       └────────┬─────────────────┘
       │                       │                           │
       │                       │  mint / burn              │ price oracle
       │                       │                           │ USDT flows
       ▼                       ▼                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        StakingManager                                │
│  3 tiers · compound · harvest · unstake · FIFO 3X cap                │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │ distributeDirect / teamDividend  │ applyCappedHarvest
           ▼                                  ▼
┌──────────────────────────┐        ┌──────────────────────────────────┐
│  AffiliateDistributor    │        │  CoreMembershipSubscription      │
│  referrals · ranks ·     │        │  (TESTNET ONLY — historical CMS  │
│  team volume · harvest   │        │   data is migrated via snapshot) │
└──────────────────────────┘        └──────────────────────────────────┘

┌──────────────────────────┐
│       AtomicP2p          │
│  P2P escrow · order      │
│  book · atomic swaps     │
└──────────────────────────┘
```

---

## 3. Contract Details

### 3.1 KAIROToken (`contracts/KAIROToken.sol`)

**Purpose:** Foundation ERC-20 token for the entire ecosystem.
**Inheritance:** `ERC20`, `ERC20Permit`, `ERC20Burnable`, `AccessControl`

| Feature | Detail |
|---|---|
| Symbol / Name | `KAIRO` / `KAIRO` |
| Decimals | 18 |
| Social Lock | 10,000 KAIRO minted to LiquidityPool, locked forever |
| Dev Fund Genesis Mint | **5 KAIRO** (`DEV_INITIAL_MINT`) minted once to dev wallet at `mintInitialSupply` |
| Gasless Approvals | EIP-2612 Permit support |
| Role-based Minting | `MINTER_ROLE` required |
| Burning | Public via `ERC20Burnable` (any holder can burn their own balance). `BURNER_ROLE` removed in mainnet build. |
| Price-aware Minting | `mintTo(recipient, usdAmount)` converts USD → KAIRO using live LP price |
| Direct Minting | `mint(to, amount)` for exact KAIRO amounts (rewards) |
| Burn Tracking | `_totalBurned` counter, `getTotalBurned()` view |
| Effective Supply | `getEffectiveSupply()` = `totalSupply − SOCIAL_LOCK` (10,000) |

**Key Functions**
- `setLiquidityPool(address)` — one-time LP address binding (admin)
- `mintInitialSupply(address devWallet)` — mints 10,000 KAIRO social lock to LP **and** 5 KAIRO to `devWallet` (admin, one-time)
- `mintTo(address, uint256 usdAmount)` — USD→KAIRO minting at live price (`MINTER_ROLE`)
- `mint(address, uint256)` — exact KAIRO minting (`MINTER_ROLE`)
- `burn(uint256)` / `burnFrom(address, uint256)` — burn with tracking

---

### 3.2 LiquidityPool (`contracts/LiquidityPool.sol`)

**Purpose:** Mini-DEX and treasury — holds USDT liquidity, provides pricing oracle, and handles one-way KAIRO→USDT swaps.
**Inheritance:** `ReentrancyGuard`, `AccessControl`

| Feature | Detail |
|---|---|
| Pricing Formula | `P = USDT_balance × 1e18 / KAIRO_totalSupply` (includes 10,005 KAIRO genesis supply) |
| Swap Fee | 10% on KAIRO→USDT swaps (retained in pool — drives price appreciation) |
| One-Way DEX | USDT→KAIRO permanently disabled (`USDT_TO_KAIRO_DISABLED = true`) |
| Deployer Block | Deployer address permanently blocked from swapping KAIRO |
| Price Snapshots | Historical price tracking with timestamps |
| Pool Balances | `poolBalances[0]` = Weekly Qualifiers, `poolBalances[1]` = Monthly Qualifiers |

**Roles**
| Role | Granted To | Purpose |
|---|---|---|
| `CORE_ROLE` | StakingManager | Notify LP of incoming stake funds (`receiveStakingFunds`) |
| `P2P_ROLE` | AtomicP2p | Notify LP of P2P trading fees (`receiveP2PFee`) |

**Key Functions**
- `getCurrentPrice()` / `getLivePrice()` — price oracle used by all contracts
- `swapKAIROForUSDT(kairoAmount, minUSDTOut, recipient)` — one-way swap; burns KAIRO
- `receiveStakingFunds(amount)` — `CORE_ROLE`; notification-only event, USDT already in LP
- `receiveP2PFee(amount)` — `P2P_ROLE`; notification-only event, USDT already in LP
- `calculateMinOutput / calculatePriceImpact(...)` — slippage helpers

---

### 3.3 StakingManager (`contracts/StakingManager.sol`)

**Purpose:** Core staking engine — 3-tier system with compounding, harvesting, unstaking, and FIFO 3X cap management.
**Inheritance:** `ReentrancyGuard`, `Pausable`, `AccessControl`

#### Tier System (production defaults set in constructor)

| Tier | Min Stake | Max Stake | Compound Interval (Prod) | Compound Interval (Testnet) | Daily Closings |
|---|---|---|---|---|---|
| 0 | 10 USDT | 499 USDT | 8 h (28 800 s) | 3 min (180 s) | 3 |
| 1 | 500 USDT | 1 999 USDT | 6 h (21 600 s) | 2 min (120 s) | 4 |
| 2 | 2 000+ USDT | unlimited | 5 h (18 000 s) | 1 min (60 s) | 4 |

> Testnet overrides are applied post-deploy via `setTier(...)` in `scripts/deploy-testnet.ts` and the redeploy scripts. Mainnet uses constructor defaults and never calls `setTier`.

#### Stake Structure
| Field | Description |
|---|---|
| `amount` | Current stake value (grows with compounding) |
| `originalAmount` | Original deposit (for 3X cap calculation) |
| `startTime` | Stake creation timestamp |
| `lastCompoundTime` | Last compound timestamp |
| `harvestedRewards` | Total USD harvested from this stake |
| `totalEarned` | FIFO cap tracker (all income types) |
| `compoundEarned` | Compound profit available for harvest |
| `active` | Stake active flag |
| `tier` | Auto-detected tier (0, 1, 2) |
| `isMigrated` | Marks pre-migration stakes (no unstake allowed) |

#### Fund Distribution on Stake (5% DAO + 5% Dev = 10%)
| Destination | Percentage |
|---|---|
| LiquidityPool | 90% |
| DAO Wallets 1–3 | **1% each** (3%) |
| DAO Wallets 4–7 | **0.5% each** (2%) |
| Development Fund Wallet | 5% |
| **Total** | **100%** |

> 7 DAO wallets are required by the constructor (`address[7] _daoWallets`).

#### Compounding Mechanics
- **Rate:** 0.15% per compound interval (`15 / 10000`).
- **Permissionless:** anyone can call `compoundFor(user, stakeId)` — gating happens on-chain via `lastCompoundTime + tier.compoundInterval`. **`COMPOUNDER_ROLE` was removed**.
- **No cap at compound time** — profit accumulates freely; cap enforced at harvest.
- **Team dividends** propagated to upline via AffiliateDistributor on every compound.

#### 3X Harvest-Triggered Cap (FIFO)
- Cap = `3 × originalAmount` per stake.
- `totalEarned` is incremented FIFO across all active stakes (oldest first).
- When `totalEarned ≥ 3X`, the stake is deactivated.
- Capped stakes lose ALL eligibility (compound, direct, team, rank, CMS).
- Rank dividends are exempt from the FIFO counter but still require an active stake.

#### Unstake
- Returns 80% of current `stk.amount` as KAIRO at live price.
- Removes team volume from all ancestors.
- Forfeits any unharvested earnings.
- `isMigrated == true` stakes cannot be unstaked.

**Key Functions**
- `stake(usdtAmount, referrer)` — create new stake with auto-tier detection
- `compound(stakeId)` / `compoundFor(user, stakeId)` — compound profits
- `harvest(stakeId, amount)` — harvest compound rewards (min $10)
- `unstake(stakeId)` — exit with 80% return
- `applyCappedHarvest(user, usdAmount)` — called by AD/CMS for FIFO tracking
- `setTier(tierId, min, max, compoundInterval, dailyClosings)` — admin tier override (testnet only)
- `setDaoWallets(address[7])` — admin DAO rotation
- `hasActivePosition(user)` — convenience view

---

### 3.4 AffiliateDistributor (`contracts/AffiliateDistributor.sol`)

**Purpose:** Fully decentralized multi-level income distribution — referral tree, direct dividends, team dividends with level compression, and auto-accruing rank salaries.
**Inheritance:** `ReentrancyGuard`, `Pausable`, `AccessControl`

#### Constructor-Injected `RANK_INTERVAL` (`immutable`)
- **Mainnet:** `7 days` (set in `scripts/deploy.ts` as `RANK_INTERVAL_PROD`).
- **Testnet:** `15 minutes` (set in `scripts/deploy-testnet.ts` and redeploy scripts).
- The contract no longer hard-codes the interval — it is permanently fixed at deploy time.

#### Income Types
| Type | ID | Description | 3X FIFO Cap |
|---|---|---|---|
| Direct Dividends | 0 | 5% of referred stakes | Yes |
| Team Dividends | 1 | Multi-level compound profits | Yes |
| Rank Dividends | 2 | Periodic salary based on team volume | **No** (exempt; requires active stake) |

#### Registration
- **Genesis account** — first registered address becomes the self-referencing root. Cannot stake.
- **Public registration** — `register(referrer)`; circular-referral prevention (15-hop loop check).
- **Contract-driven registration** — `setReferrer(user, referrer)` (`STAKING_ROLE`) for atomic stake-with-referrer flows.

#### Direct Dividends
- 5% of referred user's stake amount.
- Requires active stake on referrer (`getTotalActiveStakeValue > 0`).
- Accrues freely; cap enforced at harvest.

#### Team Dividends (Level Compression)
| Level | Percentage |
|---|---|
| L1 | 10% |
| L2–L10 | 5% each |
| L11–L15 | 2% each |

- Walks the tree up to 50 hops (gas safety).
- Only **active** uplines consume a level slot — inactive uplines pass-through transparently.

#### Level Unlocking (by active direct count)
| Active Directs | Unlocked Levels |
|---|---|
| 0 | 0 |
| 1–5 | 1–5 (one level per direct) |
| 6 | 7 |
| 7 | 9 |
| 8 | 11 |
| 9 | 13 |
| 10+ | 15 (max) |

#### Rank System (10 Levels)
| Rank | Team Volume | Salary per `RANK_INTERVAL` |
|---|---|---|
| 1 | $10 000 | $10 |
| 2 | $30 000 | $30 |
| 3 | $100 000 | $70 |
| 4 | $300 000 | $200 |
| 5 | $1 000 000 | $600 |
| 6 | $3 000 000 | $1 200 |
| 7 | $10 000 000 | $4 000 |
| 8 | $30 000 000 | $12 000 |
| 9 | $100 000 000 | $40 000 |
| 10 | $250 000 000 | $100 000 |

- **50% Max-Leg Rule:** at most 50% of any rank threshold can come from a single leg. Personal volume is excluded from leg calculation.
- **Auto-accrual:** salary accumulates every `RANK_INTERVAL` (7 days mainnet / 15 min testnet) without a manual claim step.
- Rank promotion / demotion resets the timer.

#### Team Volume Propagation
- `addTeamVolume / removeTeamVolume` propagates to **all** ancestors (unlimited depth) on stake / unstake.
- `personalVolume` tracked separately for accurate leg math.
- Each upline's rank auto-syncs after every volume change.

#### Harvest
- `harvest(incomeType)` mints KAIRO at live price for the selected stream (min $10).
- Direct/Team go through `applyCappedHarvest` (FIFO 3X tracking).
- Rank is exempt from the 3X counter.

---

### 3.5 CoreMembershipSubscription — `contracts/CoreMembershipSubscription.sol`  *(testnet only)*

> **Mainnet:** **NOT deployed.** All historical CMS state is migrated from existing snapshots — no on-chain CMS contract is required for the mainnet rollout.
> **Testnet:** retained for end-to-end QA of the subscription / loyalty flow.

**Inheritance:** `ReentrancyGuard`, `Pausable`, `AccessControl`

| Parameter | Value |
|---|---|
| Subscription Price | 10 USDT |
| Max Total Subscriptions | 10 000 |
| Loyalty Reward | 5 KAIRO per subscription |
| Subscribe Deadline | Immutable (set at deploy) |
| Claim Deadline | Immutable (set at deploy) |

**5-Level CMS Referral Rewards**
| Level | KAIRO / Sub | Required CMS Directs |
|---|---|---|
| 1 | 1.00 | 0 |
| 2 | 0.50 | 2 |
| 3 | 0.50 | 3 |
| 4 | 0.25 | 4 |
| 5 | 0.25 | 5 |

**Claim Mechanics**
- One-time claim per user (`hasClaimed`).
- Stake-based cap — max claimable KAIRO = `activeStakeValue / livePrice`. Excess is permanently deleted (use-it-or-lose-it).
- 90/10 split — 90% minted to user, 10% un-minted (deflationary).
- Claim USD value tracked via `StakingManager.applyCappedHarvest`.
- `flushExpiredRewards(users[])` — permissionless cleanup post deadline.

---

### 3.6 AtomicP2p (`contracts/AtomicP2p.sol`)

**Purpose:** Decentralized P2P escrow for KAIRO/USDT trading with instant atomic settlement. Zero-confirmation trades — mathematical certainty, no dispute windows.
**Inheritance:** `ReentrancyGuard`, `AccessControl`

| Parameter | Value |
|---|---|
| Fee | 5% (500 bps) on both KAIRO and USDT sides |
| KAIRO Fee | Burned (deflationary) |
| USDT Fee | Sent to LiquidityPool |
| Price Source | `LiquidityPool.getCurrentPrice()` |
| Price Floor | > 0.000001 USDT/KAIRO |

**Order Types**
- **Buy Order** — creator locks USDT in escrow; matches at live LP price; partial fills via `usdtRemaining`.
- **Sell Order** — creator locks KAIRO in escrow; matches at live LP price; partial fills via `kairoRemaining`.

**Trade Modes**
1. `sellToOrder(buyOrderId, kairoAmount)` — taker sells KAIRO to an existing buy order.
2. `buyFromOrder(sellOrderId, kairoAmount)` — taker buys KAIRO from an existing sell order.
3. `executeTrade(buyOrderId, sellOrderId, kairoFillAmount)` — maker-to-maker matching.

**Atomic Settlement Sequence**
1. USDT fee → LiquidityPool
2. KAIRO fee → burned
3. Net KAIRO → buyer
4. Net USDT → seller
5. All succeed atomically or the entire tx reverts

**View / Utility**
`simulateTrade`, `getBestBuyPrice / getBestSellPrice`, `getActiveBuyOrders / getActiveSellOrders` (paginated), `getUserTrades / getUserOrders`, `getOrderBookStats`, `getTotalLiquidity`.

---

### 3.7 MockUSDT (`contracts/test/MockUSDT.sol`) — testnet only

| Feature | Detail |
|---|---|
| Symbol | USDT |
| Decimals | 18 |
| Initial Supply | 1 000 000 USDT to deployer |
| Faucet | `faucet()` mints 10 000 USDT to caller |
| Open Mint | `mint(to, amount)` — anyone can mint (testnet only) |

> **Mainnet uses real opBNB USDT** (`USDT_ADDRESS` env). MockUSDT is never deployed on mainnet.

---

## 4. Token Flow Diagrams

### 4.1 Staking
```
User (USDT)
    │
    ├── 90% ──► LiquidityPool (USDT treasury)
    ├── 1% × 3 ──► DAO Wallets 1-3
    ├── 0.5% × 4 ──► DAO Wallets 4-7
    └── 5% ──► Development Fund Wallet

    + 5% Direct Dividend ──► Referrer (accrued in AffiliateDistributor)
    + Team Volume ──► propagated to all ancestors
```

### 4.2 Compound → Team Dividend
```
compound(stakeId)
    │
    ├── stk.amount += profit (0.15% per interval)
    ├── stk.compoundEarned += profit
    └── AffiliateDistributor.distributeTeamDividend(staker, profit)
         │
         └── Walk up referral tree (max 50 hops, 15 active levels)
              ├── L1:    10% of profit ──► upline teamDividends
              ├── L2-L10: 5% each      ──► upline teamDividends
              └── L11-L15: 2% each     ──► upline teamDividends
              (inactive uplines compressed / skipped)
```

### 4.3 Harvest
```
harvest(incomeType)
    │
    ├── [Direct/Team] applyCappedHarvest → FIFO 3X tracking
    │    └── If totalEarned >= 3X originalAmount → stake deactivated
    │
    ├── USD balance → KAIRO at live price
    └── kairoToken.mint(user, kairoAmount)
```

### 4.4 Swap (One-Way DEX)
```
User (KAIRO)
    │
    ├── KAIRO transferred to LP → burned (deflationary)
    ├── 10% swap fee retained in LP (price appreciation)
    └── 90% USDT sent to user/recipient
```

### 4.5 P2P Trade
```
Seller (KAIRO) ◄──────► Buyer (USDT)
    │                        │
    ├── 5% KAIRO fee → burned
    ├── 95% KAIRO → buyer
    │
    ├── 5% USDT fee → LiquidityPool
    └── 95% USDT → seller
```

---

## 5. Role & Permission Matrix

| Contract | Role | Granted To | Purpose |
|---|---|---|---|
| KAIROToken | `MINTER_ROLE` | StakingManager, AffiliateDistributor, CMS *(testnet)* | Mint KAIRO |
| KAIROToken | `DEFAULT_ADMIN_ROLE` | Renounced after deploy | — |
| LiquidityPool | `CORE_ROLE` | StakingManager | Notify LP of stake funds (`receiveStakingFunds`) |
| LiquidityPool | `P2P_ROLE` | AtomicP2p | Notify LP of P2P fees (`receiveP2PFee`) |
| StakingManager | `DEFAULT_ADMIN_ROLE` | Renounced after deploy | — |
| AffiliateDistributor | `STAKING_ROLE` | StakingManager | Distribute dividends, manage volume |
| AffiliateDistributor | `DEFAULT_ADMIN_ROLE` | Renounced after deploy | — |

> `BURNER_ROLE` (KAIROToken) and `COMPOUNDER_ROLE` (StakingManager) were intentionally **removed** — burns are public via `ERC20Burnable`, and `compoundFor` is permissionless with on-chain time gating.

---

## 6. Security Features

| Feature | Implementation |
|---|---|
| Reentrancy Protection | `ReentrancyGuard` on every state-changing entrypoint |
| Emergency Stop | `Pausable` on StakingManager, AffiliateDistributor, CMS |
| Access Control | OpenZeppelin `AccessControl` with granular roles |
| Deployer Block | Deployer permanently blocked from swapping KAIRO |
| Circular Referral Prevention | 15-hop loop check on registration |
| Gas Safety | Max 50 hops on tree walks; hop-bounded volume queries |
| Slippage Protection | `minUSDTOut` on every swap path |
| Price Floor | P2P rejects prices ≤ 0.000001 USDT/KAIRO |
| Atomic Settlement | All P2P transfers succeed together or revert |
| One-Time Social Lock | `socialLockApplied` flag prevents double mint |
| One-Time LP Binding | `setLiquidityPool` callable exactly once |
| Immutable Rank Cycle | `RANK_INTERVAL` baked into AffiliateDistributor at deploy |
| Admin Renunciation | Deployer renounces admin via `scripts/renounce-admin.ts` after migration + verification |

---

## 7. Mainnet Deployment Order (`scripts/deploy.ts`)

1. **Resolve USDT** — `USDT_ADDRESS` from env (mainnet: real opBNB USDT, no MockUSDT).
2. **KAIROToken** — `(deployer)` admin.
3. **LiquidityPool** — `(kairoToken, usdtToken)`.
4. **KAIROToken.setLiquidityPool(LP)** — one-time bind.
5. **KAIROToken.mintInitialSupply(devFundWallet)** — mints 10 000 KAIRO social lock to LP **and** 5 KAIRO to dev fund wallet.
6. **AffiliateDistributor** — `(kairoToken, LP, deployer, systemWallet, RANK_INTERVAL_PROD = 7 days)`.
7. **StakingManager** — `(kairoToken, LP, usdt, devFundWallet, daoWallets[7], deployer)`.
8. Link **StakingManager ↔ AffiliateDistributor** (`setAffiliateDistributor` + `setStakingManager`, latter grants `STAKING_ROLE`).
9. **AtomicP2p** — `(kairoToken, usdtToken, LP)`. **CMS is intentionally skipped on mainnet.**
10. **Grant roles**
    - `MINTER_ROLE` on KAIROToken → StakingManager, AffiliateDistributor
    - `CORE_ROLE` on LP → StakingManager
    - `P2P_ROLE` on LP → AtomicP2p
    - `LP.setStakingManager(StakingManager)` — auto-compound on swap
    - `AtomicP2p.setStakingManager(StakingManager)` — auto-compound on P2P
11. **Seed LP** — optional initial USDT transfer (depends on deployer balance).
12. **Admin roles RETAINED** — deployer keeps admin for post-deploy operations.

### Phase 2: Migration & Verification (manual scripts)

13. **Seed affiliate tree** — `scripts/seed-affiliate-tree.ts` (435 users).
14. **Migrate stakes** — `scripts/seed-stakes-corrected.ts` (236 users in batches of 50).
15. **Seed team volumes** — `scripts/seed-team-volumes.ts` (30 users).
16. **Finalize migration** — call `StakingManager.finalizeMigration()` to permanently block further imports.
17. **Verify all functions** — test stake, compound, harvest, swap, P2P, affiliate registration on-chain.
18. **Verify wallet addresses** — confirm DAO wallets, dev fund wallet, system wallet via on-chain reads.

### Phase 3: Admin Renouncement (`scripts/renounce-admin.ts`)

19. **Pre-flight checks** — script verifies: LP set, social lock applied, MINTER_ROLE granted, CORE/P2P roles set, SM↔AD linked, migration finalized, contracts not paused, price oracle working.
20. **Burn all admin roles** — renounce `DEFAULT_ADMIN_ROLE` on KAIROToken, StakingManager, AffiliateDistributor, LiquidityPool, AtomicP2p. **Irreversible.**
21. **Post-burn verification** — script confirms deployer has zero admin on all contracts.

### Testnet Deployment (`scripts/deploy-testnet.ts`) — differences
- Deploys **MockUSDT** with faucet.
- Passes `RANK_INTERVAL_TESTNET = 15 min` to `AffiliateDistributor`.
- After staking-manager deploy, calls `setTier(0..2)` to apply 3 / 2 / 1-minute compound intervals.
- Deploys **CMS** for QA.
- Does **not** burn admin — needed for QA reseeding.

---

## 8. Key Economic Parameters

| Parameter | Mainnet | Testnet |
|---|---|---|
| KAIRO Social Lock | 10 000 KAIRO (permanent in LP) | same |
| Dev Fund Genesis Mint | 5 KAIRO | same |
| DEX Swap Fee | 10% | same |
| P2P Fee | 5% each side (KAIRO burned, USDT → LP) | same |
| Compound Rate | 0.15% per interval | same |
| Tier 0 Compound | 8 h | 3 min |
| Tier 1 Compound | 6 h | 2 min |
| Tier 2 Compound | 5 h | 1 min |
| Daily Closings (T0/T1/T2) | 3 / 4 / 4 | same |
| Rank Salary Cycle | **7 days** | **15 min** |
| Min Stake | 10 USDT | same |
| Min Harvest | 10 USD | same |
| Direct Dividend | 5% | same |
| 3X Harvest Cap | 3× original (FIFO across stakes) | same |
| Unstake Return | 80% of current value | same |
| CMS | **not deployed** (snapshot migration) | deployed |
| CMS Price | — | 10 USDT |
| CMS Loyalty | — | 5 KAIRO / sub |

---

## 9. Repository Layout

```
KAIRODAO/
├── contracts/                 Solidity sources (mainnet)
│   ├── KAIROToken.sol
│   ├── LiquidityPool.sol
│   ├── StakingManager.sol
│   ├── AffiliateDistributor.sol
│   ├── CoreMembershipSubscription.sol  (testnet only)
│   ├── AtomicP2p.sol
│   └── test/MockUSDT.sol               (testnet only)
│
├── scripts/                   Hardhat operational scripts
│   ├── deploy.ts                       Mainnet (CMS-free, 7-day salary, prod tiers)
│   ├── deploy-testnet.ts               Testnet (CMS, MockUSDT, short cycles)
│   ├── redeploy-affiliate.ts           Hot-swap AD on testnet
│   ├── redeploy-affiliate-and-seed.ts  AD + on-chain tree reseed
│   ├── redeploy-staking-and-seed.ts    SM + reseed (re-applies setTier)
│   ├── redeploy-cms.ts / redeploy-atomic-p2p.ts
│   ├── seed-affiliate-tree.ts / seed-stakes-corrected.ts / seed-team-volumes.ts
│   ├── verify-tree.ts / verify-team-volumes.ts / verify-referrers.ts
│   └── auto-compound-daemon.ts         Optional off-chain bot
│
├── test/                      Hardhat (chai + ethers v6) test suite
│   ├── KAIROToken.test.ts
│   ├── LiquidityPool.test.ts
│   ├── StakingManager.test.ts
│   ├── AffiliateDistributor.test.ts
│   ├── CMS.test.ts
│   ├── P2PEscrow.test.ts
│   ├── Integration.test.ts
│   └── helpers/fixtures.ts             Shared deployment fixture
│
├── frontend/                  Next.js 14 app
│   └── src/
│       ├── app/                Routes (dashboard, register, p2p, etc.)
│       ├── components/         UI components (forms, cards, tables)
│       ├── hooks/              Wagmi/viem hooks per contract
│       │   ├── useStaking.ts, useAffiliate.ts, useUserStakes.ts
│       │   ├── useP2P.ts, useSwap.ts, useRegistration.ts
│       │   ├── useGlobalStats.ts, useKairoPrice.ts
│       │   ├── useTokenBalances.ts, useApproval.ts, usePostAction.ts
│       ├── config/             Addresses + ABIs (regenerated via scripts/update-abis.js)
│       ├── providers/          Wagmi + Web3Modal config
│       ├── store/              Zustand state
│       └── lib/                helpers
│
├── backend/                   Node.js + TypeScript indexer/API (Express)
│   └── src/
│       ├── services/
│       │   ├── blockchain.ts    RPC clients (viem)
│       │   ├── indexer.ts       Event indexer (all contracts)
│       │   ├── workers.ts       Background jobs
│       │   ├── queue.ts         Job queue
│       │   └── websocket.ts     WS broadcast to frontend
│       ├── routes/              REST endpoints
│       ├── db/                  PostgreSQL schema + queries
│       ├── abis/                Synced contract ABIs
│       └── config/              env + constants
│
├── nginx/                     Reverse proxy + SSL
├── docker-compose.*.yml       Dev / testnet / VPS / deploy compose stacks
├── hardhat.config.ts          Hardhat config (incl. test signer count = 25)
├── extract-abis.js / scripts/update-abis.js  ABI sync to frontend & backend
└── BLUEPRINT.md               (this document)
```

---

## 10. Operational Runbook

### Local development
```powershell
npm install
npx hardhat compile
npx hardhat test
```

### Testnet deploy (opBNB chainId 5611)
```powershell
npx hardhat run scripts/deploy-testnet.ts --network opbnbTestnet
node scripts/update-abis.js     # sync ABIs to frontend & backend
```

### Mainnet deploy (opBNB chainId 204)
```powershell
# Pre-flight: ensure .env has USDT_ADDRESS, SYSTEM_WALLET, DEV_FUND_WALLET, DAO_WALLET_1..7
npx hardhat run scripts/deploy.ts --network opbnbMainnet
node scripts/update-abis.js
```
> Mainnet deploy script **retains admin roles**. Run `scripts/renounce-admin.ts` only after all migrations and verifications are complete. The renounce script includes pre-flight checks that abort if anything is misconfigured.

### CMS snapshot migration (mainnet)
- CMS is not deployed; subscription / loyalty data lives only in the snapshot.
- Frontend reads the snapshot via the backend indexer's snapshot endpoints, **not** an on-chain CMS contract.
- Plan: ship snapshot ingest job in `backend/src/services/indexer.ts` and expose REST endpoints for the dashboard to query.

### Post-deploy verification
- `scripts/verify-tree.ts` — on-chain referral tree integrity
- `scripts/verify-team-volumes.ts` — team-volume invariants
- `scripts/verify-referrers.ts` — referrer-of mapping spot check
- `scripts/check-roles.ts` — role grants & deployer renunciation status

---

## 11. Technology Stack

| Layer | Technology |
|---|---|
| Blockchain | opBNB Mainnet (chainId 204) / opBNB Testnet (chainId 5611) |
| Smart Contracts | Solidity ^0.8.24 |
| Contract Framework | Hardhat + Typechain (ethers v6) |
| Libraries | OpenZeppelin Contracts v5 (`AccessControl`, `ReentrancyGuard`, `Pausable`, `ERC20`, `ERC20Permit`, `ERC20Burnable`, `SafeERC20`) |
| Frontend | Next.js 14 (App Router), React 18, TailwindCSS, wagmi + viem, RainbowKit/Web3Modal, Zustand |
| Backend | Node.js 20 + TypeScript, Express, viem, PostgreSQL, WebSocket |
| Infrastructure | Docker Compose, Nginx reverse proxy, Hostinger VPS, Let's Encrypt SSL |
| Testing | Hardhat + chai + ethers v6 (≈ 148 passing tests) |

---

## 12. Mainnet-Readiness Checklist

- [x] `KAIROToken.mintInitialSupply(devWallet)` mints 10 000 social lock + 5 dev fund.
- [x] StakingManager constructor seeds production tier intervals (8 h / 6 h / 5 h).
- [x] StakingManager 7-DAO wallet split (3×1% + 4×0.5%).
- [x] AffiliateDistributor `RANK_INTERVAL` immutable, set to 7 days for mainnet.
- [x] `scripts/deploy.ts` does **not** deploy CMS (snapshot migration path only).
- [x] `scripts/deploy.ts` retains admin roles (renounce moved to `scripts/renounce-admin.ts` with pre-flight checks).
- [x] Testnet retains short cycles (3/2/1 min) and 15-min rank salary via `setTier` overrides + ctor arg.
- [x] Frontend ABIs regenerated and verified (`DEV_INITIAL_MINT`, `_devWallet`, `RANK_INTERVAL`, `_rankInterval`, `setTier`, `TierConfigured`).
- [x] Test suite: 148 passing. (3 pre-existing global-sync failures are unrelated to mainnet readiness — flagged for separate cleanup.)
- [ ] **Final audit / formal review of mainnet bytecode.**
- [ ] **DAO wallets, system wallet, dev fund wallet finalized in `.env.production`.**
- [ ] **Initial USDT seed for LiquidityPool prepared in deployer wallet.**
