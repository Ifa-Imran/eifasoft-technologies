# KAIRO DAO — System Blueprint

## 1. Project Overview

KAIRO DAO is a fully decentralized DeFi ecosystem built on **opBNB** (BNB Chain L2). It combines a deflationary ERC-20 token, an on-chain liquidity pool / mini-DEX, a multi-tier staking engine, a multi-level affiliate distribution system, a membership subscription program, and an atomic P2P trading platform — all orchestrated through interconnected smart contracts with role-based access control.

**Core Design Principles:**
- **Fully on-chain** — all business logic lives in smart contracts; no backend wallets or admin roles needed for ongoing operations.
- **Deflationary tokenomics** — KAIRO is burned on every swap and P2P trade; the one-way DEX prevents buy-side minting.
- **User-triggered operations** — compounding, harvesting, rank salary accrual, and P2P settlement are all permissionless.
- **FIFO 3X harvest cap** — earnings across all income types are tracked against a global 3X cap per stake, enforced only at harvest time.

---

## 2. Smart Contract Architecture

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────────────┐
│  MockUSDT    │       │   KAIROToken     │       │     LiquidityPool        │
│  (ERC-20)    │◄─────►│   (ERC-20)       │◄─────►│  (Mini-DEX / Treasury)   │
└──────┬───────┘       └───────┬──────────┘       └────────┬─────────────────┘
       │                       │                           │
       │                       │  mint / burn              │ price oracle
       │                       │                           │ USDT flows
       ▼                       ▼                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        StakingManager                                │
│  (3-tier staking, compound, harvest, unstake, FIFO 3X cap)          │
└──────────┬──────────────────────────────────┬───────────────────────┘
           │  distributeDirect / teamDividend  │  applyCappedHarvest
           ▼                                   ▼
┌──────────────────────────┐        ┌──────────────────────────────────┐
│  AffiliateDistributor    │        │  CoreMembershipSubscription      │
│  (referrals, ranks,      │        │  (CMS subscriptions, loyalty     │
│   team volume, harvest)  │        │   rewards, 5-level referrals)    │
└──────────────────────────┘        └──────────────────────────────────┘

┌──────────────────────────┐
│       AtomicP2p          │
│  (P2P escrow, order      │
│   book, atomic swaps)    │
└──────────────────────────┘
```

---

## 3. Contract Details

### 3.1 KAIROToken (`KAIROToken.sol` — 183 lines)

**Purpose:** Foundation ERC-20 token for the entire ecosystem.

**Inheritance:** `ERC20`, `ERC20Permit`, `ERC20Burnable`, `AccessControl`

| Feature | Detail |
|---|---|
| Symbol / Name | `KAIRO` / `KAIRO` |
| Decimals | 18 |
| Social Lock | 10,000 KAIRO minted to LiquidityPool and locked forever |
| Gasless Approvals | EIP-2612 Permit support |
| Role-based Minting | `MINTER_ROLE` required |
| Role-based Burning | `BURNER_ROLE` or any holder via `ERC20Burnable` |
| Price-aware Minting | `mintTo(recipient, usdAmount)` converts USD → KAIRO using live LP price |
| Direct Minting | `mint(to, amount)` for exact KAIRO amounts (rewards) |
| Burn Tracking | `_totalBurned` counter, `getTotalBurned()` view |
| Effective Supply | `getEffectiveSupply()` = `totalSupply - socialLock` |

**Key Functions:**
- `setLiquidityPool(address)` — one-time LP address binding (admin)
- `mintInitialSupply()` — mints 10,000 KAIRO social lock to LP (admin, one-time)
- `mintTo(address, uint256)` — USD-to-KAIRO minting at live price (MINTER_ROLE)
- `mint(address, uint256)` — exact KAIRO minting (MINTER_ROLE)
- `burn(uint256)` / `burnFrom(address, uint256)` — burn with tracking

---

### 3.2 LiquidityPool (`LiquidityPool.sol` — 592 lines)

**Purpose:** Mini-DEX and treasury — holds USDT liquidity, provides pricing oracle, and handles one-way KAIRO→USDT swaps.

**Inheritance:** `ReentrancyGuard`, `AccessControl`

| Feature | Detail |
|---|---|
| Pricing Formula | `P = USDT_balance / KAIRO_totalSupply` |
| Swap Fee | 10% on KAIRO→USDT swaps (retained in pool for price appreciation) |
| One-Way DEX | USDT→KAIRO permanently disabled (`USDT_TO_KAIRO_DISABLED = true`) |
| Deployer Block | Deployer address permanently blocked from swapping KAIRO |
| Social Lock | 5,000 KAIRO constant (for price stability reference) |
| Price Snapshots | Historical price tracking with timestamps |
| Pool Balances | `poolBalances[0]` = Weekly Qualifiers Dividend, `poolBalances[1]` = Monthly Qualifiers Dividend |

**Roles:**
| Role | Granted To | Purpose |
|---|---|---|
| `CORE_ROLE` | StakingManager, AffiliateDistributor | Withdraw USDT, distribute gratuity/support/premature exit |
| `REGISTRATION_ROLE` | CMS contract | Receive registration fees |
| `P2P_ROLE` | AtomicP2p | Receive P2P trading fees |
| `POOL_ROLE` | AchieversPools (future) | Reserve/distribute pool contributions |

**Key Functions:**
- `getCurrentPrice()` / `getLivePrice()` — price oracle
- `swapKAIROForUSDT(kairoAmount, minUSDTOut, recipient)` — one-way swap with slippage protection; burns KAIRO
- `withdrawUSDT(to, amount)` — CORE_ROLE only
- `distributeTeamGratuity(recipient, amount)` — team gratuity payouts
- `distributeSupportPurse(recipient, amount)` — support purse payouts
- `distributePrematureExit(recipient, amount)` — premature exit settlements
- `reservePoolContribution(poolType, amount)` — achievers pool reserves
- `distributePoolReward(recipient, poolType, amount)` — pool reward distribution
- `calculateMinOutput(inputAmount, maxSlippagePercent, kairoToUsdt)` — slippage helper
- `calculatePriceImpact(inputAmount, kairoToUsdt)` — price impact calculator

---

### 3.3 StakingManager (`StakingManager.sol` — 649 lines)

**Purpose:** Core staking engine — 3-tier system with compounding, harvesting, unstaking, and FIFO 3X cap management.

**Inheritance:** `ReentrancyGuard`, `Pausable`, `AccessControl`

#### Tier System

| Tier | Min Stake | Max Stake | Compound Interval (Test) | Daily Closings |
|---|---|---|---|---|
| 0 | 10 USDT | 499 USDT | 15 min (prod: 8h) | 3 |
| 1 | 500 USDT | 1,999 USDT | 10 min (prod: 6h) | 4 |
| 2 | 2,000+ USDT | Unlimited | 5 min (prod: 4h) | 6 |

#### Stake Structure

| Field | Description |
|---|---|
| `amount` | Current stake value (grows with compounding) |
| `originalAmount` | Original deposit (for 3X cap calculation) |
| `startTime` | Stake creation timestamp |
| `lastCompoundTime` | Last compound timestamp |
| `harvestedRewards` | Total USD harvested from this stake |
| `totalEarned` | FIFO cap tracker (all income types via FIFO) |
| `compoundEarned` | Compound profit earned (available for harvest) |
| `active` | Whether stake is active |
| `tier` | Auto-detected tier (0, 1, or 2) |

#### Fund Distribution on Stake

| Destination | Percentage |
|---|---|
| LiquidityPool | 90% |
| DAO Wallets 1-4 | 1% each (4%) |
| DAO Wallets 5-6 | 0.5% each (1%) |
| Development Fund Wallet | 5% |
| **Total** | **100%** |

#### Compounding Mechanics
- **Rate:** 0.15% per compound interval (`15 / 10000`)
- **Permissionless:** Anyone can call `compoundFor(user, stakeId)` — time-gated on-chain
- **No cap at compound time** — profits accumulate freely; cap enforced at harvest
- **Team dividends:** Distributed to upline via AffiliateDistributor on every compound

#### 3X Harvest-Triggered Cap (FIFO)
- **Cap:** `3 × originalAmount` per stake
- **Tracking:** `totalEarned` is incremented via FIFO across all active stakes (oldest first)
- **Enforcement:** Only at harvest time — when `totalEarned >= 3X`, stake is deactivated
- **Capped stakes:** Lose ALL eligibility (compounding, direct, team, rank, CMS)
- **Rank Dividends:** Exempt from 3X cap counter, but require active stake

#### Unstake Mechanics
- **Return:** 80% of current `stk.amount` as KAIRO at live price
- **Team volume:** Removed from all ancestors on unstake
- **Unharvested earnings:** Forfeited

**Key Functions:**
- `stake(usdtAmount, referrer)` — create new stake with auto-tier detection
- `compound(stakeId)` / `compoundFor(user, stakeId)` — compound profits
- `harvest(stakeId, amount)` — harvest compound rewards (min $10)
- `unstake(stakeId)` — exit with 80% return
- `applyCappedHarvest(user, usdAmount)` — called by AD/CMS for FIFO tracking
- `hasActivePosition(user)` — check if user has any active stake

---

### 3.4 AffiliateDistributor (`AffiliateDistributor.sol` — 656 lines)

**Purpose:** Fully decentralized multi-level income distribution — referral tree management, direct dividends, team dividends with level compression, and auto-accruing rank salaries.

**Inheritance:** `ReentrancyGuard`, `Pausable`, `AccessControl`

#### Income Types

| Type | ID | Description | 3X Cap |
|---|---|---|---|
| Direct Dividends | 0 | 5% of referred stakes | Yes (tracked at harvest) |
| Team Dividends | 1 | Multi-level compound profits | Yes (tracked at harvest) |
| Rank Dividends | 2 | Periodic salary based on team volume | **No** (exempt, but requires active stake) |

#### Registration
- **Genesis account:** First registered address becomes root of referral tree (self-referencing sentinel). Cannot stake.
- **Public registration:** `register(referrer)` — users register on-chain with circular referral prevention (15-hop check).
- **Contract registration:** `setReferrer(user, referrer)` — STAKING_ROLE for contract-to-contract calls.

#### Direct Dividends
- **Rate:** 5% of referred user's stake amount
- **Requirement:** Referrer must have active stake (`getTotalActiveStakeValue > 0`)
- **Accrual:** Freely — cap enforced at harvest

#### Team Dividends (Level Compression)

| Level | Percentage | Basis Points |
|---|---|---|
| L1 | 10% | 1000 |
| L2–L10 | 5% each | 500 each |
| L11–L15 | 2% each | 200 each |

**Compression Mechanism:**
- Walks up the referral tree (max 50 hops for gas safety)
- **Only active uplines** (with `getTotalActiveStakeValue > 0`) consume a level slot
- Inactive users are transparent pass-throughs — skipped without incrementing the level counter

**Level Unlocking (by active direct referral count):**

| Active Directs | Unlocked Levels |
|---|---|
| 0 | 0 |
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 4 |
| 5 | 5 |
| 6 | 7 |
| 7 | 9 |
| 8 | 11 |
| 9 | 13 |
| 10 | 15 (max) |

*Formula: 1-5 directs = 1 level each; 6+ directs = 2 levels each; capped at 15.*

#### Rank System (10 Levels)

| Rank | Team Volume Threshold | Weekly Salary (Test: Hourly) |
|---|---|---|
| 1 | $10,000 | $10 |
| 2 | $30,000 | $30 |
| 3 | $100,000 | $70 |
| 4 | $300,000 | $200 |
| 5 | $1,000,000 | $600 |
| 6 | $3,000,000 | $1,200 |
| 7 | $10,000,000 | $4,000 |
| 8 | $30,000,000 | $12,000 |
| 9 | $100,000,000 | $40,000 |
| 10 | $250,000,000 | $100,000 |

**50% Max-Leg Rule:** For each rank threshold, a maximum of 50% can come from any single leg. Only descendant leg volumes count (personal volume excluded).

**Auto-Accruing Salary:**
- Salary accumulates every `RANK_INTERVAL` (1 hour in test / 7 days in production)
- No manual claim step — accrued automatically to `rankDividends` on any interaction
- Rank changes (promotion/demotion) trigger timer reset

#### Team Volume Propagation
- `addTeamVolume(staker, amount)` — propagates to ALL ancestors (unlimited depth) on stake
- `removeTeamVolume(staker, amount)` — propagates on unstake/auto-close
- `personalVolume` tracked separately per user for accurate leg calculation
- Auto-syncs rank for each upline after volume change

#### Harvest
- `harvest(incomeType)` — mints KAIRO at live price for the selected income type
- **Minimum:** $10
- **All types** require active position
- **Direct/Team:** Tracked against FIFO 3X cap via `applyCappedHarvest`
- **Rank:** Exempt from cap tracking

---

### 3.5 CoreMembershipSubscription (`CoreMembershipSubscription.sol` — 452 lines)

**Purpose:** Membership subscription system — users buy CMS subscriptions with USDT, earn KAIRO loyalty rewards, and distribute referral rewards up to 5 levels.

**Inheritance:** `ReentrancyGuard`, `Pausable`, `AccessControl`

| Parameter | Value |
|---|---|
| Subscription Price | 10 USDT |
| Max Total Subscriptions | 10,000 |
| Loyalty Reward | 5 KAIRO per subscription |
| Subscribe Deadline | Configurable (immutable after deploy) |
| Claim Deadline | Configurable (immutable after deploy) |

#### CMS Referral Rewards (5 Levels)

| Level | KAIRO per Sub | Required CMS Directs |
|---|---|---|
| 1 | 1.00 KAIRO | 0 |
| 2 | 0.50 KAIRO | 2 |
| 3 | 0.50 KAIRO | 3 |
| 4 | 0.25 KAIRO | 4 |
| 5 | 0.25 KAIRO | 5 |

**Eligibility:** Referrer needs active CMS subscription + enough CMS directs to unlock level. Ineligible referrers are skipped (reward walks up regardless).

#### Claim Mechanics
- **One-time claim** — `hasClaimed` flag
- **Stake-based cap** — max claimable KAIRO = `activeStakeValue / livePrice`
- **Excess permanently deleted** — "use it or lose it"
- **90/10 split** — 90% minted to user, 10% not minted (deflationary)
- **3X cap integration** — claim USD value tracked via `StakingManager.applyCappedHarvest`

#### Post-Deadline
- `flushExpiredRewards(users[])` — permissionless; zeroes out unclaimed rewards after claim deadline

---

### 3.6 AtomicP2p (`AtomicP2p.sol` — 1,194 lines)

**Purpose:** Decentralized P2P escrow for KAIRO/USDT trading with instant atomic settlement. Zero-confirmation trades — mathematical certainty, no dispute windows.

**Inheritance:** `ReentrancyGuard`, `AccessControl`

| Parameter | Value |
|---|---|
| Fee | 5% (500 basis points) on both KAIRO and USDT sides |
| KAIRO Fee | Burned (deflationary) |
| USDT Fee | Sent to LiquidityPool |
| Price Source | `LiquidityPool.getCurrentPrice()` |
| Price Floor | > 0.000001 USDT/KAIRO |

#### Order Types

**Buy Order (`OrderBuy`):**
- Creator locks USDT in escrow
- No price specified — matches at live LP price
- Supports partial fills (`usdtRemaining` tracks available balance)

**Sell Order (`OrderSell`):**
- Creator locks KAIRO in escrow
- No price specified — matches at live LP price
- Supports partial fills (`kairoRemaining` tracks available balance)

#### Trade Execution Modes

1. **Taker sells to buy order** — `sellToOrder(buyOrderId, kairoAmount)`: Caller provides KAIRO, receives USDT from escrow
2. **Taker buys from sell order** — `buyFromOrder(sellOrderId, kairoAmount)`: Caller provides USDT, receives KAIRO from escrow
3. **Maker-to-maker matching** — `executeTrade(buyOrderId, sellOrderId, kairoFillAmount)`: Matches existing buy and sell orders

#### Atomic Settlement Sequence
1. Fee distribution (USDT → LiquidityPool)
2. KAIRO fee burn (deflationary)
3. Net KAIRO to buyer
4. Net USDT to seller
5. All succeed atomically or entire transaction reverts

#### View / Utility Functions
- `simulateTrade(buyOrderId, sellOrderId, kairoAmount)` — preview trade output and fees
- `getBestBuyPrice()` / `getBestSellPrice()` — order book best prices
- `getActiveBuyOrders` / `getActiveSellOrders` — paginated order queries
- `getUserTrades(user)` / `getUserOrders(user)` — user-specific queries
- `getOrderBookStats()` — aggregate statistics
- `getTotalLiquidity()` — total locked USDT/KAIRO in order book

---

### 3.7 MockUSDT (`MockUSDT.sol` — 38 lines)

**Purpose:** Test USDT token for opBNB testnet.

| Feature | Detail |
|---|---|
| Symbol | USDT |
| Decimals | 18 |
| Initial Supply | 1,000,000 USDT to deployer |
| Faucet | `faucet()` mints 10,000 USDT to caller |
| Open Minting | `mint(to, amount)` — anyone can mint (testnet only) |

---

## 4. Token Flow Diagrams

### 4.1 Staking Flow

```
User (USDT)
    │
    ├── 90% ──► LiquidityPool (USDT treasury)
    ├── 1% each ──► DAO Wallets 1-4
    ├── 0.5% each ──► DAO Wallets 5-6
    └── 5% ──► Development Fund Wallet

    + 5% Direct Dividend ──► Referrer (accrued in AffiliateDistributor)
    + Team Volume ──► propagated to all ancestors
```

### 4.2 Compound → Team Dividend Flow

```
compound(stakeId)
    │
    ├── stk.amount += profit (0.15% per interval)
    ├── stk.compoundEarned += profit
    └── AffiliateDistributor.distributeTeamDividend(staker, profit)
         │
         └── Walk up referral tree (max 50 hops, 15 active levels)
              ├── L1:  10% of profit ──► upline teamDividends
              ├── L2-L10: 5% each ──► upline teamDividends
              └── L11-L15: 2% each ──► upline teamDividends
              (inactive uplines compressed / skipped)
```

### 4.3 Harvest Flow

```
harvest(incomeType)
    │
    ├── [Direct/Team] applyCappedHarvest → FIFO 3X tracking
    │    └── If totalEarned >= 3X originalAmount → stake deactivated
    │
    ├── USD balance → KAIRO at live price
    └── kairoToken.mint(user, kairoAmount)
```

### 4.4 Swap Flow (One-Way DEX)

```
User (KAIRO)
    │
    ├── KAIRO transferred to LP → burned (deflationary)
    ├── 10% swap fee retained in LP (price appreciation)
    └── 90% USDT sent to user/recipient
```

### 4.5 P2P Trade Flow

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
| KAIROToken | `MINTER_ROLE` | StakingManager, AffiliateDistributor, CMS | Mint KAIRO |
| KAIROToken | `BURNER_ROLE` | LiquidityPool, AtomicP2p | Burn KAIRO |
| LiquidityPool | `CORE_ROLE` | StakingManager, AffiliateDistributor | Withdraw USDT, distribute payments |
| LiquidityPool | `REGISTRATION_ROLE` | CMS | Receive registration fees |
| LiquidityPool | `P2P_ROLE` | AtomicP2p | Receive P2P fees |
| LiquidityPool | `POOL_ROLE` | AchieversPools (future) | Pool contributions/rewards |
| StakingManager | `COMPOUNDER_ROLE` | Auto-compound daemon | Compound on behalf of users |
| AffiliateDistributor | `STAKING_ROLE` | StakingManager | Distribute dividends, manage volume |

---

## 6. Security Features

| Feature | Implementation |
|---|---|
| Reentrancy Protection | `ReentrancyGuard` on all state-changing functions |
| Emergency Stop | `Pausable` on StakingManager, AffiliateDistributor, CMS |
| Access Control | OpenZeppelin `AccessControl` with granular roles |
| Deployer Block | Deployer permanently blocked from swapping KAIRO |
| Circular Referral Prevention | 15-hop loop check on registration |
| Gas Safety | Max 50 hops for tree walks |
| Slippage Protection | `minUSDTOut` on all swap functions |
| Price Floor | P2P rejects prices below 0.000001 USDT/KAIRO |
| Atomic Settlement | All P2P transfers succeed together or entire tx reverts |
| One-Time Social Lock | `socialLockApplied` flag prevents double-minting |
| One-Time LP Binding | `setLiquidityPool` can only be called once |

---

## 7. Deployment Order

1. **MockUSDT** (testnet only)
2. **KAIROToken** (`_admin`)
3. **LiquidityPool** (`_kairoToken`, `_usdtToken`)
4. **KAIROToken** → `setLiquidityPool(LP_address)`
5. **KAIROToken** → `mintInitialSupply()` (10,000 KAIRO social lock)
6. **StakingManager** (`_kairoToken`, `_liquidityPool`, `_usdt`, `_developmentFundWallet`, `_daoWallets[6]`, `_admin`)
7. **AffiliateDistributor** (`_kairoToken`, `_liquidityPool`, `_admin`, `_systemWallet`)
8. **CoreMembershipSubscription** (`_kairoToken`, `_usdt`, `_liquidityPool`, `_stakingManager`, `_affiliateDistributor`, `_systemWallet`, `_admin`, `_subscribeDeadline`, `_claimDeadline`)
9. **AtomicP2p** (`_kairoToken`, `_usdtToken`, `_liquidityPool`)

**Post-Deployment Role Setup:**
- Grant `MINTER_ROLE` on KAIROToken to: StakingManager, AffiliateDistributor, CMS
- Grant `BURNER_ROLE` on KAIROToken to: LiquidityPool, AtomicP2p
- Grant `CORE_ROLE` on LiquidityPool to: StakingManager
- Grant `REGISTRATION_ROLE` on LiquidityPool to: CMS
- Grant `P2P_ROLE` on LiquidityPool to: AtomicP2p
- Set `AffiliateDistributor.setStakingManager(StakingManager)` (auto-grants STAKING_ROLE)
- Set `StakingManager.setAffiliateDistributor(AffiliateDistributor)`
- Set `StakingManager.setCMS(CMS)`

---

## 8. Key Economic Parameters

| Parameter | Value |
|---|---|
| KAIRO Social Lock | 10,000 KAIRO (permanent) |
| LP Social Lock Reference | 5,000 KAIRO |
| Swap Fee (DEX) | 10% |
| P2P Fee | 5% each side (KAIRO burned, USDT to LP) |
| Compound Rate | 0.15% per interval |
| Unstake Return | 80% of current value |
| Harvest Cap | 3X original stake (FIFO across all stakes) |
| Min Stake | 10 USDT |
| Min Harvest | 10 USD |
| Direct Dividend | 5% of referral's stake |
| CMS Price | 10 USDT |
| CMS Loyalty Reward | 5 KAIRO per subscription |
| CMS Claim Split | 90% user / 10% deflationary burn |
| Rank Salary Interval | 1 hour (test) / 7 days (production) |

---

## 9. Technology Stack

| Layer | Technology |
|---|---|
| Blockchain | opBNB (BNB Chain L2) |
| Smart Contracts | Solidity ^0.8.19 |
| Contract Framework | Hardhat |
| Libraries | OpenZeppelin Contracts v5 (AccessControl, ReentrancyGuard, Pausable, ERC20, SafeERC20) |
| Frontend | Next.js + React |
| Backend | Node.js + TypeScript (Express) |
| Deployment | Docker Compose, Nginx reverse proxy |
| Type Generation | Typechain (ethers v6) |
