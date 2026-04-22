# KAIRODAO — Full Project Blueprint

## 1. Project Overview

KAIRODAO is a **DeFi ecosystem** built on **opBNB (BNB Chain Layer-2)** featuring a custom ERC20 token (KAIRO), auto-compounding staking, a multi-level affiliate system, a membership subscription program, and a peer-to-peer atomic exchange. The system is designed with **deflationary tokenomics** — KAIRO can only be swapped one-way (KAIRO → USDT), and all P2P trade fees are burned.

**Network:** opBNB Testnet (Chain ID: 5611)  
**Token:** KAIRO (ERC20, 18 decimals)  
**Stablecoin:** MockUSDT (ERC20, 18 decimals — testnet)

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                    │
│   Pages: Dashboard, CMS, Stake, Team Dividend, Exchange,         │
│          Swap, Referrals, Analytics, Register                    │
│   Hooks: useStaking, useAffiliate, useCMS, useP2P, useSwap...   │
│   Chain: wagmi + viem + RainbowKit (WalletConnect)               │
└────────────────────┬─────────────────────────────────────────────┘
                     │ REST API + WebSocket
┌────────────────────▼─────────────────────────────────────────────┐
│                     BACKEND (Express + TypeScript)                │
│   Services: Indexer, Workers (BullMQ), WebSocket, Blockchain     │
│   DB: PostgreSQL  |  Queue: Redis + BullMQ                       │
│   Key Jobs: Auto-Compound (per-tier), Rank Updates               │
└────────────────────┬─────────────────────────────────────────────┘
                     │ JSON-RPC / WebSocket
┌────────────────────▼─────────────────────────────────────────────┐
│                    SMART CONTRACTS (Solidity 0.8.19)              │
│   7 Contracts on opBNB Testnet                                   │
│   MockUSDT, KAIROToken, LiquidityPool, StakingManager,          │
│   AffiliateDistributor, CoreMembershipSubscription, AtomicP2p    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Smart Contracts

### 3.1 MockUSDT
**Purpose:** Test stablecoin for opBNB testnet.  
**Key Features:**
- ERC20 with 18 decimals
- Public `mint()` and `faucet()` (10,000 USDT) for testing
- Deployer receives 1,000,000 USDT on construction

### 3.2 KAIROToken
**Purpose:** Foundation ERC20 token for the ecosystem.  
**Key Features:**
- ERC20 + ERC20Permit (gasless approvals) + ERC20Burnable
- AccessControl: `MINTER_ROLE`, `BURNER_ROLE`
- **Social Lock:** 10,000 KAIRO minted to LiquidityPool and permanently locked
- `mintTo(recipient, usdAmount)` — price-aware minting via LiquidityPool oracle (USD → KAIRO at live price)
- `mint(to, amount)` — direct KAIRO minting (for rewards)
- Tracks `totalBurned` and `effectiveSupply` (totalSupply - socialLock)

**Role Grants:**
- `MINTER_ROLE` → StakingManager, AffiliateDistributor, CMS
- `BURNER_ROLE` → LiquidityPool, AtomicP2p

### 3.3 LiquidityPool
**Purpose:** Mini-DEX and price oracle for the ecosystem.  
**Price Formula:** `P = USDT_balance / totalSupply` (includes social lock KAIRO)  
**Key Features:**
- **One-way DEX:** Only KAIRO → USDT swaps (deflationary — KAIRO is burned on swap)
- 10% swap fee retained in pool (price appreciation)
- Deployer permanently blocked from swapping
- Slippage protection and price impact calculation
- Price history snapshots
- Fund reception from: Staking (90%), Registration, P2P fees
- Fund distribution: Team Gratuity, Support Purse, Premature Exit, Pool Rewards
- Pool balances for Weekly/Monthly Qualifiers Dividend

**Roles:** `CORE_ROLE` (StakingManager, CMS), `REGISTRATION_ROLE`, `P2P_ROLE` (AtomicP2p), `POOL_ROLE`

### 3.4 StakingManager
**Purpose:** Core staking engine with 3-tier auto-compounding.  
**Key Features:**

| Tier | Range | Compound Interval (Test) | Compound Interval (Prod) |
|------|-------|--------------------------|--------------------------|
| Bronze (0) | $10 – $499 | 15 min | 8 hours |
| Silver (1) | $500 – $1,999 | 10 min | 6 hours |
| Gold (2) | $2,000+ | 5 min | 4 hours |

- **Profit Rate:** 0.15% per compound interval
- **3X Harvest-Triggered Cap (FIFO):** Profits accumulate freely; cap only enforced at harvest time. When total harvested reaches 3X originalAmount via FIFO order (oldest stake first), stake deactivates.
- **Unstake:** 80% return as KAIRO (minted at live price), harvested amounts already deducted
- **Fund Distribution on Stake:** 90% → LiquidityPool, 5% → 6 DAO wallets (1% × 4 + 0.5% × 2), 5% → Development Fund
- **Affiliate Integration:** 5% direct dividend to referrer on stake; team dividends distributed on compound
- **Permissionless Compounding:** `compoundFor(user, stakeId)` — anyone can compound for anyone (time-gated)
- Genesis account (first registered) cannot stake

**External Calls on Compound:**
1. Calculate profit (0.15% × intervals passed)
2. Add profit to stake amount
3. Call `AffiliateDistributor.distributeTeamDividend(staker, profit)` — distributes to 15 upline levels

**External Calls on Stake:**
1. Transfer USDT and distribute (90/5/5)
2. Call `AffiliateDistributor.distributeDirect(referrer, stakeAmount)` — 5% direct dividend
3. Call `AffiliateDistributor.addTeamVolume(staker, amount)` — propagate to all ancestors

### 3.5 AffiliateDistributor
**Purpose:** Decentralized multi-level income distribution (referral tree, dividends, rank salary).  
**Income Types:**
| Type | Name | Source | Cap |
|------|------|--------|-----|
| 0 | Direct Dividends | 5% of referred stakes | 3X FIFO |
| 1 | Team Dividends | Multi-level compound profits | 3X FIFO |
| 2 | Rank Dividends | Periodic salary (auto-accumulates) | Exempt from 3X cap |

**Registration:**
- Public `register(referrer)` — on-chain referral tree
- Genesis mode: first user registers without referrer (becomes root)
- Circular referral protection (15-level check)

**Team Dividend Levels (15 levels):**
- L1: 10%, L2-L10: 5% each, L11-L15: 2% each
- Unlock: 1-5 directs = 1-5 levels; each additional direct = 2 more levels (max 15 at 10 directs)
- Only **active** directs (with active stake) count for unlocking

**Rank System (10 ranks):**
| Rank | Title | Team Volume Required | Salary/Period |
|------|-------|---------------------|---------------|
| 1 | Associate | $10K | $10 |
| 2 | Executive | $30K | $30 |
| 3 | Director | $100K | $70 |
| 4 | Vice President | $300K | $200 |
| 5 | Senior VP | $1M | $600 |
| 6 | Managing Director | $3M | $1,200 |
| 7 | Partner | $10M | $4,000 |
| 8 | Senior Partner | $30M | $12,000 |
| 9 | Global Leader | $100M | $40,000 |
| 10 | Chairman | $250M | $100,000 |

- **50% Max-Leg Rule:** Largest leg volume capped at 50% of total for rank calculation
- **Rank Interval:** 1 hour (testing) / 7 days (production)
- Salary auto-accumulates without user action; users just harvest
- `_accrueAndSyncRank()` called on volume changes and harvests

**Harvest Flow:**
1. Auto-accrue pending rank salary
2. Check active stake requirement
3. For capped income (Direct/Team): track in StakingManager FIFO
4. Mint KAIRO at live price to user

**Team Volume:**
- `addTeamVolume` / `removeTeamVolume` — propagates to ALL ancestors (unlimited depth)
- Auto-syncs rank for each ancestor on volume change

### 3.6 CoreMembershipSubscription (CMS)
**Purpose:** Limited membership subscription with KAIRO loyalty & leadership rewards.  
**Key Features:**
- **Price:** 10 USDT per subscription
- **Max Supply:** 10,000 subscriptions globally
- **Loyalty Reward:** 5 KAIRO per subscription purchased
- **Leadership Rewards (5 levels):**

| Level | Reward/Sub | Directs Required |
|-------|-----------|-----------------|
| 1 | 1 KAIRO | 0 |
| 2 | 0.5 KAIRO | 2 |
| 3 | 0.5 KAIRO | 3 |
| 4 | 0.25 KAIRO | 4 |
| 5 | 0.25 KAIRO | 5 |

- Referrer must have active CMS subscription + enough CMS directs to unlock level
- **Deadlines:** Subscribe by May 6, 2026 UTC; Claim by June 1, 2026 UTC (immutable)
- **One-time Claim:** Stake-gated (requires active stake), capped by stake value
- **90/10 Split:** 90% minted to user, 10% deflationary (not minted)
- CMS claims tracked against 3X FIFO cap via StakingManager
- Excess rewards permanently deleted on claim
- Admin can flush unclaimed rewards after claim deadline

### 3.7 AtomicP2p
**Purpose:** Decentralized peer-to-peer escrow for KAIRO/USDT trades.  
**Key Features:**
- **Zero-confirmation atomic swaps** — instant settlement
- **Order Types:** Buy orders (lock USDT), Sell orders (lock KAIRO)
- **Price:** Uses LiquidityPool live price (no user-specified price)
- **Fees:** 5% on both sides (USDT fee → LiquidityPool, KAIRO fee → burned)
- **Execution Modes:**
  - `sellToOrder(buyOrderId, kairoAmount)` — taker sells KAIRO to existing buy order
  - `buyFromOrder(sellOrderId, kairoAmount)` — taker buys KAIRO from existing sell order
  - `executeTrade(buyOrderId, sellOrderId, kairoAmount)` — match existing orders
- Partial fills supported
- Order cancellation with refund
- Trade history and order book statistics

---

## 4. Contract Inter-Dependencies & Role Matrix

```
KAIROToken
├── MINTER_ROLE → StakingManager, AffiliateDistributor, CMS
└── BURNER_ROLE → LiquidityPool, AtomicP2p

LiquidityPool
├── CORE_ROLE → StakingManager, CMS
├── P2P_ROLE → AtomicP2p
└── REGISTRATION_ROLE → (unused currently)

StakingManager
├── COMPOUNDER_ROLE → Deployer (backend)
├── affiliateDistributor → AffiliateDistributor
└── cmsContract → CMS

AffiliateDistributor
└── STAKING_ROLE → StakingManager

CMS → reads StakingManager, AffiliateDistributor, LiquidityPool, KAIROToken
AtomicP2p → reads LiquidityPool; burns KAIRO; sends USDT fees to LP
```

---

## 5. Backend Architecture

### 5.1 Technology Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Queue:** Redis + BullMQ
- **Blockchain:** viem (JSON-RPC + WebSocket)
- **Real-time:** WebSocket (ws)

### 5.2 Services

| Service | File | Purpose |
|---------|------|---------|
| Blockchain | `blockchain.ts` | viem client, contract instances, provider initialization |
| Indexer | `indexer.ts` | Listens to on-chain events, syncs to PostgreSQL |
| Workers | `workers.ts` | BullMQ workers: auto-compound, rank updates |
| Queue | `queue.ts` | BullMQ queue definitions and scheduled jobs |
| WebSocket | `websocket.ts` | Real-time event broadcasting to frontend |

### 5.3 BullMQ Scheduled Jobs

| Queue | Job | Interval (Test) | Interval (Prod) | Action |
|-------|-----|-----------------|-----------------|--------|
| compounding | compound-tier-0 | 15 min | 8 hours | Compound all active Bronze stakes |
| compounding | compound-tier-1 | 10 min | 6 hours | Compound all active Silver stakes |
| compounding | compound-tier-2 | 5 min | 4 hours | Compound all active Gold stakes |
| rank-update | hourly-rank-update | 1 hour | 7 days | Check rank changes for all users |

**Compound Worker Flow:**
1. Query PostgreSQL for active stakes of the given tier that are due
2. Call `compoundAllStakes()` first (compounds all eligible stakes on-chain)
3. Call `StakingManager.compoundFor(user, stakeId)` for each
4. On success: update `last_compound` in DB, broadcast via WebSocket

**Rank Update Worker Flow:**
1. Query all users with team volume
2. Calculate rank using 50% max-leg rule
3. Call `AffiliateDistributor.checkRankChange(user)` on-chain
4. Update rank in DB

### 5.4 API Routes

| Prefix | File | Endpoints |
|--------|------|-----------|
| `/api/v1` | `user.ts` | User-specific data (stakes, affiliates, earnings) |
| `/api/v1` | `global.ts` | Global stats (TVL, price, supply) |
| `/api/v1` | `p2p.ts` | P2P order book and trade history |
| `/api/v1` | `admin.ts` | Admin operations |

### 5.5 Health Check
- `GET /health` — returns status, timestamp, uptime

---

## 6. Frontend Architecture

### 6.1 Technology Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Web3:** wagmi + viem + RainbowKit
- **State:** React hooks (no external state library)

### 6.2 Pages (App Router)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Marketing page with hero, features, stats |
| `/register` | Register | On-chain registration with referrer link |
| `/dashboard` | Dashboard | Overview: stakes, income summary, rank info |
| `/cms` | CMS | Core Membership: subscribe, countdown timer, rewards, claim |
| `/stake` | Staking | Create stakes, view tier groups, harvest, compound calculator |
| `/team-dividend` | Team Dividend | 15-level breakdown, leg volumes, rank activation tracker |
| `/referrals` | Referrals | Direct referral list, referral link sharing |
| `/exchange` | Exchange | P2P atomic trading (buy/sell orders) |
| `/swap` | Swap | KAIRO → USDT one-way swap via LiquidityPool |
| `/analytics` | Analytics | Price charts, TVL, supply stats |

### 6.3 Custom Hooks

| Hook | Purpose |
|------|---------|
| `useStaking` | Stake, compound, harvest, harvestTier operations |
| `useUserStakes` | Read user stakes, tier groups, cap progress |
| `useAffiliate` | All affiliate data: income, referrals, team volume, leg volumes, rank, team level stats |
| `useCMS` | CMS subscription data: counts, rewards, deadlines, claim status, level details |
| `useP2P` | P2P order book: create/cancel orders, execute trades |
| `useSwap` | KAIRO → USDT swap via LiquidityPool |
| `useRegistration` | On-chain registration, referrer detection from URL params |
| `useApproval` | ERC20 approval flow (check allowance, approve) |
| `useTokenBalances` | USDT and KAIRO balance display |
| `useKairoPrice` | Live KAIRO price from LiquidityPool |
| `useGlobalStats` | TVL, total supply, price snapshots, swap stats |

### 6.4 Component Structure

```
src/components/
├── dashboard/       # IncomeSummary, RankCard, StakeOverview, QuickActions
├── landing/         # Hero, Features, Stats, CTA
├── layout/          # Sidebar, Header, MobileNav, AppShell
├── tx/              # TransactionToast, TxHistory, TxProvider
└── ui/              # GlassCard, Button, Input, Badge, ProgressBar, etc.
```

### 6.5 Configuration
- Contract addresses loaded from environment variables (`NEXT_PUBLIC_*`)
- Chain ID: 5611 (opBNB testnet)
- Explorer: `https://testnet.opbnbscan.com`
- Backend API URL and WebSocket URL from `.env`

---

## 7. Economic Model Summary

### 7.1 Fund Flow on Stake
```
User stakes $X USDT
├── 90% → LiquidityPool (backing KAIRO price)
├── 5%  → 6 DAO Wallets (1% × 4 + 0.5% × 2)
├── 5%  → Development Fund Wallet
└── Referrer earns 5% direct dividend (accrued in AffiliateDistributor)
```

### 7.2 Compound Cycle
```
Every interval (tier-based):
├── Profit = stake.amount × 0.15%
├── Stake amount compounds (profit added)
├── Team dividends distributed to 15 upline levels
└── No cap at compound time (accumulates freely)
```

### 7.3 Harvest & 3X Cap
```
On harvest (user-triggered):
├── Full amount always paid (no clamping)
├── FIFO tracking: oldest active stake absorbs first
├── When stake's totalEarned reaches 3X originalAmount → deactivated
├── KAIRO minted at live price from LiquidityPool oracle
└── Rank dividends exempt from 3X cap
```

### 7.4 Deflationary Mechanics
1. **One-way DEX:** KAIRO → USDT only (burned on swap)
2. **P2P Burns:** 5% KAIRO fee burned on every P2P trade
3. **CMS 10% burn:** 10% of CMS claim rewards not minted (deflationary)
4. **Swap fees:** 10% USDT fee retained in LiquidityPool (price appreciation)

---

## 8. Deployment Infrastructure

### 8.1 Contract Deployment
- **Tool:** Hardhat
- **Script:** `scripts/deploy.ts` — deploys all 7 contracts, configures roles, seeds liquidity
- **Network:** opBNB Testnet (chain ID 5611)

### 8.2 Production Deployment (Hostinger VPS)
- **Orchestration:** Docker Compose via Hostinger MCP
- **Domain:** dev.kairodao.com
- **SSL:** Traefik with Let's Encrypt auto-SSL
- **Services:**
  - `postgres` — PostgreSQL 15 (Alpine)
  - `redis` — Redis 7 (Alpine)
  - `backend` — Node.js 18 (Alpine), Express on port 4000
  - `frontend` — Node.js 18 (Alpine), Next.js standalone on port 3000
  - `traefik` — Reverse proxy with HTTPS

### 8.3 Environment Variables

**Backend:**
```
DATABASE_URL, REDIS_URL, RPC_URL, RPC_WS_URL, CHAIN_ID,
INDEXER_PRIVATE_KEY, SYSTEM_WALLET,
KAIRO_TOKEN_ADDRESS, LIQUIDITY_POOL_ADDRESS, STAKING_MANAGER_ADDRESS,
AFFILIATE_DISTRIBUTOR_ADDRESS, CMS_ADDRESS, ATOMIC_P2P_ADDRESS
```

**Frontend:**
```
NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_WS_URL, NEXT_PUBLIC_CHAIN_ID,
NEXT_PUBLIC_KAIRO_TOKEN, NEXT_PUBLIC_LIQUIDITY_POOL,
NEXT_PUBLIC_STAKING_MANAGER, NEXT_PUBLIC_AFFILIATE_DISTRIBUTOR,
NEXT_PUBLIC_CMS, NEXT_PUBLIC_ATOMIC_P2P, NEXT_PUBLIC_USDT,
NEXT_PUBLIC_SYSTEM_WALLET, NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

---

## 9. Current Contract Addresses (v22 — opBNB Testnet)

| Contract | Address |
|----------|---------|
| MockUSDT | `0x81f0D105e9FdA4bAe1B82c7363a2dc55B7cF7F91` |
| KAIROToken | `0x0EE000667c9EB12df820f557107C7d5e5A08512b` |
| LiquidityPool | `0xd1c8155F6952AAaFe2114EA242541FE527131Abd` |
| AffiliateDistributor | `0xf73eF4a7b852B00B766E5FcC6f905dc48Cd7aCFf` |
| StakingManager | `0x4C529AF1C5dD36FB4836ED03fC85CE2859c86d3a` |
| CMS | `0x896031d437F6c928648ac2DBBeE79B0e0D08409C` |
| AtomicP2p | `0xec6BCC94A15646f5fCdE274582e44De3fF8Ea6Ab` |

---

## 10. Testing vs Production Differences

| Parameter | Testing | Production |
|-----------|---------|------------|
| Bronze compound interval | 15 min (900s) | 8 hours (28,800s) |
| Silver compound interval | 10 min (600s) | 6 hours (21,600s) |
| Gold compound interval | 5 min (300s) | 4 hours (14,400s) |
| Rank salary interval | 1 hour | 7 days |
| CMS subscribe deadline | Production dates | May 6, 2026 UTC |
| CMS claim deadline | Production dates | June 1, 2026 UTC |
| USDT token | MockUSDT (free mint) | Real USDT |
