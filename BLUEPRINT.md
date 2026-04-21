# KAIRO DAO Ecosystem Blueprint

**Network**: opBNB Testnet (Chain ID: 5611) | **Version**: v18 | **Admin roles**: Burned (COMPOUNDER_ROLE retained)

---

## 1. Contract Architecture (7 Contracts)

```
MockUSDT ──────────────────────────────────────────────────┐
  (38 lines) Free-mint test token, 18 decimals             │
  faucet() → 10,000 USDT per call                          │
                                                           ▼
KAIROToken ──────────────────────── LiquidityPool ◄──── [90% of stakes]
  ERC20 + Permit + Burnable           Mini-DEX (KAIRO/USDT)
  MINTER_ROLE / BURNER_ROLE           P = USDT_balance / totalSupply
  10,000 KAIRO social lock            One-way: KAIRO→USDT only (10% fee)
  mintTo(addr, usdAmt) via price      Deployer blocked from swapping
  getEffectiveSupply()                 Price snapshots, TVL tracking
         │                                     ▲        ▲
         │ mint()                              │        │
         ▼                                     │        │
AffiliateDistributor ◄───────────── StakingManager      │
  15-level referral tree                3-tier staking    │
  3 income types:                       0.15% per interval│
    0=Direct (5% of stakes)             3X FIFO cap       │
    1=Team (10%/5%/2% by level)         80% unstake return│
    2=Rank (auto-accruing salary)       Fund split:       │
  Harvest → mint KAIRO at live price      90% → LP ───────┘
  50% max-leg rule for ranks              5% → 6 DAO wallets (1%×4 + 0.5%×2)
  Rank salary: 1h intervals (test)        5% → Dev fund wallet
         ▲                                     │
         │ setReferrer()                       │
         │                                     ▼
CoreMembershipSubscription        AtomicP2p
  10 USDT/sub, max 10,000           Atomic P2P escrow
  5 KAIRO loyalty/sub               Order book: buy/sell orders
  5-level leadership rewards         5% fee (both sides)
  One-time claim, stake-capped       KAIRO fees → burned (deflationary)
  90/10 user/burn split              USDT fees → LiquidityPool
  Immutable deadlines (3h/6h test)   Zero-confirmation settlement
```

---

## 2. Money Flow

| Event | USDT Flow | KAIRO Flow |
|---|---|---|
| **Stake** | 90% → LP, 5% → 6 DAOs, 5% → Dev wallet | — |
| **Compound** (0.15%/interval) | — | Stake value grows (virtual USDT) |
| **Harvest (compound)** | Deducted from stake amount | Minted at live price |
| **Harvest (direct/team)** | — | Minted at live price, FIFO cap |
| **Harvest (rank)** | — | Minted at live price, **NO cap** |
| **Unstake** | — | 80% of current value minted as KAIRO |
| **KAIRO→USDT swap** | USDT sent to user (10% fee stays in LP) | KAIRO burned |
| **CMS subscribe** | 10 USDT → LP directly | — |
| **CMS claim** | — | 90% minted to user, 10% not minted (deflationary) |
| **P2P trade** | 5% USDT fee → LP | 5% KAIRO fee → burned |

---

## 3. Staking Tiers (Testing intervals)

| Tier | Range (USDT) | Compound Interval | Profit/Interval |
|---|---|---|---|
| Bronze | 10 – 499 | 15 min | 0.15% |
| Silver | 500 – 1,999 | 10 min | 0.15% |
| Gold | 2,000+ | 5 min | 0.15% |

### 3X Harvest-Triggered Cap (FIFO)

**Core Principle**: Capping is triggered **only by harvesting**, not by earning. Compounding and profit accrual continue indefinitely regardless of how much has been earned.

**How it works:**
1. **Staking & Compounding**: When a stake is initiated, profits accrue and compounding is applied after every closing. Ongoing earnings do **not** impact capping automatically — compounding should never be stopped prematurely.
2. **Capping on Harvest**: The 3X limit is checked only when income (excluding Rank Dividend) is officially harvested. Until the total harvested amount reaches the 3X cap, staking earnings and compounding continue as usual.
3. **Earnings exceeding 3X**: If total earnings surpass 3X but have not yet been harvested, both staking profit and compounding continue normally. At the time of harvest, the **full exceeding value** is also withdrawn — it is NOT automatically clipped to the 3X cap.
4. **When harvested amount hits 3X cap**:
   - **Status**: The stake immediately becomes **inactive**
   - **Rank Eligibility**: The ID is **no longer counted** toward any rank eligibility
   - **Dividends**: The ID ceases to qualify for Direct Income, Rank Dividends, or Team Dividends until a new active stake is created
5. **FIFO order**: Harvests are applied to the oldest active stake first. Once that stake's harvested total reaches 3× originalAmount, it deactivates and subsequent harvests apply to the next stake.

**Key distinction from Rank Dividends**: Rank Dividends do not count toward the 3X harvested cap. However, once a stake becomes inactive (harvested amount = 3X), the user needs another active stake to continue receiving any dividends including Rank Dividends.

---

## 4. Affiliate Income System

**Registration**: On-chain, genesis account is first registrant (self-referencing sentinel). Cannot stake.

### Direct Dividends (type 0)
5% of referred user's stake amount → accrues to referrer. Requires active stake.

### Team Dividends (type 1)
On every compound, profit distributed up 15 levels:
- L1: 10%, L2–L10: 5% each, L11–L15: 2% each
- Level unlock: 1–5 active directs → 1–5 levels; 6–10 directs → 7, 9, 11, 13, 15 levels
- "Active direct" = has active stake position

### Rank Dividends (type 2)
Auto-accruing salary every 1 hour (test), based on team volume with 50% max-leg rule:

| Rank | Team Volume | Salary/Period |
|---|---|---|
| 1 Associate | $10K | $10 |
| 2 Executive | $30K | $30 |
| 3 Director | $100K | $70 |
| 4 VP | $300K | $200 |
| 5 Senior VP | $1M | $600 |
| 6 Managing Dir | $3M | $1,200 |
| 7 Partner | $10M | $4,000 |
| 8 Senior Partner | $30M | $12,000 |
| 9 Global Leader | $100M | $40,000 |
| 10 Chairman | $250M | $100,000 |

Rank syncs automatically on `addTeamVolume` / `removeTeamVolume` — no manual checkRankChange needed.

---

## 5. CMS (CoreMembershipSubscription)

- **Price**: 10 USDT per sub, max 10,000 global
- **Loyalty**: 5 KAIRO per sub purchased
- **Leadership**: 5-level referral rewards (1, 0.5, 0.5, 0.25, 0.25 KAIRO per sub)
- **Level unlock**: 0, 2, 3, 4, 5 CMS-active directs
- **Claim**: One-time, capped by active stake value, subject to 3X FIFO cap, 90/10 split
- **Deadlines**: Immutable (3h subscribe, 6h claim from deploy — test mode)

---

## 6. P2P Trading (AtomicP2p)

- **Model**: Order book with atomic settlement at LiquidityPool live price
- **Orders**: Buy (lock USDT) / Sell (lock KAIRO), partial fills supported
- **Execution**: `sellToOrder()`, `buyFromOrder()`, `executeTrade()` (match existing orders)
- **Fees**: 5% on both sides — USDT fee → LP (liquidity), KAIRO fee → burned (deflation)
- **Safety**: ReentrancyGuard, price sanity check (>0.000001 USDT/KAIRO)

---

## 7. Deflationary Mechanics

1. **One-way DEX**: Only KAIRO→USDT swaps allowed, KAIRO is **burned** on every swap
2. **P2P KAIRO fees**: 5% of every P2P trade's KAIRO side is burned
3. **CMS claim**: 10% of claim amount is never minted (deflationary)
4. **Price formula**: `P = USDT_balance / totalSupply` — as KAIRO burns and USDT accumulates from fees, price appreciates
5. **Social lock**: 10,000 KAIRO locked forever in LP (ensures non-zero supply)

---

## 8. Role Architecture (Post-Deployment)

| Contract | Active Roles | Burned Roles |
|---|---|---|
| KAIROToken | MINTER_ROLE (SM, AD, CMS), BURNER_ROLE (LP, P2P) | DEFAULT_ADMIN_ROLE |
| LiquidityPool | CORE_ROLE (SM), REGISTRATION_ROLE (CMS), P2P_ROLE (P2P) | DEFAULT_ADMIN_ROLE |
| StakingManager | COMPOUNDER_ROLE (daemon wallet) | DEFAULT_ADMIN_ROLE |
| AffiliateDistributor | STAKING_ROLE (SM) | DEFAULT_ADMIN_ROLE |
| CMS | — | DEFAULT_ADMIN_ROLE |
| AtomicP2p | — | DEFAULT_ADMIN_ROLE, ADMIN_ROLE |

**COMPOUNDER_ROLE** is the only non-burned role — used by the auto-compound daemon to call `compoundFor()` permissionlessly.

---

## 9. v18 Deployed Addresses (opBNB Testnet)

| Contract | Address |
|---|---|
| MockUSDT | `0xcFF16786A3d7f372Fa93D72aF9b27c91e884cEA5` |
| KAIROToken | `0x7Fee741907649f5a8E105B0e9a70d1dF4B5a5C60` |
| LiquidityPool | `0x62865d26dFf25F1527C9aA962f3BE2828e9cc3Ef` |
| AffiliateDistributor | `0xc1e192AaCd196AE277f45c35Df98674e098CB393` |
| StakingManager | `0x9d48b6C43fC858767b451De5Efa2ed1089bf3d1a` |
| CMS | `0x70ec427b6afB5c07e527d0C9A66aed78274126f5` |
| AtomicP2p | `0x6a379f594c706D5df0d596e9ABFc0Ec002f63F63` |

---

## 10. Frontend Pages

| Page | Description |
|---|---|
| `/dashboard` | Portfolio overview, active stakes, income summary, referral widget, mint test USDT |
| `/stake` | Create stakes, compound, harvest, unstake with tier display |
| `/referrals` | Referral link, direct referrals list, team tree, income breakdown |
| `/team-dividend` | 15-level team dividend details, level unlock progress |
| `/cms` | Buy CMS subscriptions, claim rewards, leadership details |
| `/swap` | One-way KAIRO→USDT swap with slippage protection |
| `/exchange` | P2P order book, create/cancel orders, execute trades |
| `/analytics` | Global stats, price chart, TVL, supply metrics |

---

## 11. Backend & Infrastructure

- **Auto-compound daemon**: Permissionless `compoundFor()` calls via COMPOUNDER_ROLE
- **VPS**: Hostinger VPS (ID: 1558058), Docker Compose + Traefik + Let's Encrypt SSL
- **Domain**: dev.kairodao.com
- **Frontend**: Next.js standalone output, NEXT_PUBLIC_* env vars baked at build time
- **Backend**: Express + BullMQ workers for event indexing
