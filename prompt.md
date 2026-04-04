KAIRO ECOSYSTEM
PROJECT OVERVIEW
Build a production-grade DeFi ecosystem on opBNB Chain consisting of 6 interconnected smart contracts, a Node.js indexing backend, and a React/Next.js frontend. The system implements a novel "3X Capping" staking mechanism with 5-level referral rewards, dynamic token minting/burning, and a Atomic AtomicP2P  mini-DEX.
1. SMART CONTRACT ARCHITECTURE (Solidity ^0.8.19)
Contract 1: KAIROToken.sol (ERC20 with Custom Logic)
solidity
Copy
// Core Requirements:
- Standard ERC20 with permit() (gasless approvals)
- Roles: MINTER_ROLE (Staking contract only), BURNER_ROLE (LP contract only)
- Initial supply: 10,000 KAIRO (minted to LP contract, locked forever)
- Dynamic minting function: mintTo(address recipient, uint256 usdAmount) - calculates KAIRO amount based on live price formula
- Social lock mechanism: 10,000 KAIRO permanently locked (can never be swapped/burned)
Contract 2: CoreMembershipSubscription.sol (CMS)
State Variables:
uint256 public constant CMS_PRICE = 10 * 10**18; // 10 USDT
uint256 public constant REWARD_PER_SUB = 5 * 10**18; // 5 KAIRO
uint256 public constant MAX_SUBS = 10000;
uint256 public deadline = 1714521600; // May 1, 2026 timestamp
mapping(address => uint256) public subscriptionCount;
mapping(address => uint256) public loyaltyRewards; // 5 KAIRO per sub
mapping(address => uint256) public leadershipRewards; // Referral rewards
mapping(address => address) public referrerOf;
Referral Structure (5 Levels):
solidity
Copy
uint256[5] public REF_REWARDS = [1e18, 0.5e18, 0.5e18, 0.25e18, 0.25e18]; // KAIRO per sub

function subscribe(uint256 _amount, address _referrer) external;
// Logic: 
// 1. Transfer _amount * 10 USDT from user
// 2. Send USDT to LiquidityPool contract
// 3. Mint 5 KAIRO per sub to loyaltyRewards[user]
// 4. Distribute referral rewards up 5 levels to leadershipRewards[referrer]
// 5. Track referrer relationships
Claim Logic (Critical):
solidity
Copy
function claimCMSRewards() external;
// Requirements:
// 1. User must have active stake in StakingContract (check external call)
// 2. Total claimable = loyaltyRewards[user] + leadershipRewards[user]
// 3. Max claimable = (user.totalStakedValue * currentPrice) in KAIRO terms
// 4. If claimable > maxClaimable, excess is permanently deleted (set to 0)
// 5. Transfer 90% to user, 10% to system wallet
// 6. Set both reward mappings to 0 (one-time only)
Contract 3: StakingManager.sol (Core Mechanics)
Tier System:
solidity
Copy
struct Tier {
    uint256 min;
    uint256 max;
    uint256 compoundInterval; // in hours: 8, 6, or 4
    uint256 dailyClosings;    // 3, 4, or 6
}

Tier[3] public TIERS = [
    Tier(10e18, 499e18, 8 hours, 3),
    Tier(500e18, 1999e18, 6 hours, 4),
    Tier(2000e18, type(uint256).max, 4 hours, 6)
];
Stake Structure:
solidity
Copy
struct Stake {
    uint256 amount;
    uint256 startTime;
    uint256 lastCompoundTime;
    uint256 harvestedRewards; // Track harvested amounts for unstake deduction
    uint256 totalEarned;      // Track for 3X cap
    bool active;
    uint8 tier;
}

mapping(address => Stake[]) public userStakes;
mapping(address => uint256) public totalActiveStakeValue;
Compounding Logic:
solidity
Copy
function compound(uint256 _stakeId) external;
// Calculate hours passed since lastCompoundTime
// For each compounding interval passed:
//   profit = currentStakeAmount * 0.1% (0.001)
//   Add to stake amount
//   Update totalEarned (for 3X cap tracking)
//   Distribute team dividends to uplines via AffiliateContract
// If totalEarned >= 3 * originalStake → autoCloseStake(_stakeId)
3X Hard Cap Implementation:
solidity
Copy
function checkCap(address _user) internal view returns (bool);
// Sum: (Vesting profits + Direct income + Team dividends) across all stakes
// If sum >= 3 * totalStakedAmount → auto-unstake (return 80%, mark inactive)
Unstaking:
solidity
Copy
function unstake(uint256 _stakeId) external;
// Return 80% of staked amount in KAIRO (at live rate)
// Deduct: harvestedRewards amount from the 80%
// Mark stake inactive
// Note: Unharvested earnings are forfeited (set to 0)
Contract 4: AffiliateDistributor.sol (Income Management)
Income Types:
solidity
Copy
mapping(address => uint256) public directDividends;  // 5% of referred stakes
mapping(address => uint256) public teamDividends;    // From vesting profits (10% L1, 5% L2-10, 2% L11-15)
mapping(address => uint256) public rankDividends;    // Weekly salary based on team volume
mapping(address => uint256) public qualifierWeekly;  // 3% of global weekly profits share
mapping(address => uint256) public qualifierMonthly; // 2% of global monthly profits share

uint256 public constant MIN_HARVEST = 10e18; // $10 minimum
Distribution Logic:
solidity
Copy
function distributeDirect(address _referrer, uint256 _stakeAmount) external onlyStaking;
// Add 5% of _stakeAmount to directDividends[_referrer]

function distributeTeamDividend(address _staker, uint256 _profit) external onlyStaking;
// Iterate through 15 levels of referrer chain
// L1: 10%, L2-10: 5% each, L11-15: 2% each
// Add to teamDividends[each_upline]

function calculateRankSalary(address _user) external view returns (uint256);
// Team volume calculation with 50% max per leg rule
// $10k=$10, $30k=$30, $100k=$70, $300k=$200, $1M=$600, $3M=$1200, $10M=$4000, $30M=$12000, $100M=$40000, $250M=$100000
Harvesting:
solidity
Copy
function harvest(uint8 _incomeType) external;
// _incomeType: 0=Direct, 1=Team, 2=Rank, 3=QualifierWeekly, 4=QualifierMonthly
// Check balance >= MIN_HARVEST
// Query LiquidityPool for live KAIRO price
// Calculate KAIRO amount = USD amount / price
// Call KAIROToken.mintTo(user, calculatedAmount)
// Reset specific income mapping to 0
Contract 5: LiquidityPool.sol (Price Oracle & Treasury)
Price Discovery:
solidity
Copy
uint256 public constant SOCIAL_LOCK = 10000e18; // 10K KAIRO locked forever

function getLivePrice() public view returns (uint256) {
    // P = USDT_balance / (KAIRO_totalSupply - KAIRO_burned + SOCIAL_LOCK)
    uint256 effectiveSupply = kairoToken.totalSupply() - totalBurned + SOCIAL_LOCK;
    return (usdtBalance * 1e18) / effectiveSupply; // Price in USDT per KAIRO
}
Swap Functions (Mini-DEX):
solidity
Copy
function swapUSDTForKAIRO(uint256 _usdtAmount, uint256 _minOut) external;
// 5% fee kept in contract (price appreciation mechanism)
// Mint KAIRO to user based on live price

function swapKAIROForUSDT(uint256 _kairoAmount, uint256 _minOut) external;
// 5% fee kept in contract
// Transfer USDT to user
Burn Function:
solidity
Copy
function burnKAIRO(uint256 _amount) external onlyRole(BURNER_ROLE);
// Add to totalBurned
// Call kairoToken.burnFrom(address(this), _amount)
Contract 6: AtomicP2P.sol (Order Book DEX)
Order Structures:
solidity
Copy
struct BuyOrder {
    address buyer;
    uint256 usdtAmount;
    uint256 pricePerToken; // User-defined limit price
    uint256 timestamp;
    bool active;
}

struct SellOrder {
    address seller;
    uint256 kairoAmount;
    uint256 pricePerToken;
    uint256 timestamp;
    bool active;
}
Trading Logic:
solidity
Copy
function createBuyOrder(uint256 _usdtAmount, uint256 _pricePerToken) external;
// Lock USDT in contract

function createSellOrder(uint256 _kairoAmount, uint256 _pricePerToken) external;
// Lock KAIRO in contract

function executeTrade(uint256 _buyId, uint256 _sellId, uint256 _amount) external;
// Match orders manually
// Calculate: _amount * pricePerToken
// Transfer 97% USDT to seller, 3% to AuxFund
// Transfer 97% KAIRO to buyer, 3% to LiquidityPool.burnKAIRO()
// Partial fills allowed

function cancelOrder(uint256 _orderId, bool isBuy) external;
// Return locked funds to creator
2. BACKEND INFRASTRUCTURE (Node.js/Express + PostgreSQL)
Purpose: Index blockchain events for fast queries, handle off-chain calculations (rank qualifications), and manage admin operations.
Tech Stack:
Runtime: Node.js 18+ with TypeScript
Database: PostgreSQL 14+ with TimescaleDB extension (for time-series staking data)
Cache: Redis (for session management and price caching)
Queue: BullMQ (for processing compounding events every 4/6/8 hours)
Web3: ethers.js v6 with WebSocket providers
Database Schema:
sql
Copy
-- Users table (indexed by wallet address)
CREATE TABLE users (
    wallet_address VARCHAR(42) PRIMARY KEY,
    referrer VARCHAR(42),
    total_staked_volume DECIMAL(20,8),
    team_volume DECIMAL(20,8),
    rank_level INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Staking positions (synced from StakingManager events)
CREATE TABLE stakes (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42),
    stake_id_on_chain INTEGER,
    amount DECIMAL(20,8),
    tier INTEGER,
    start_time TIMESTAMP,
    last_compound TIMESTAMP,
    total_earned DECIMAL(20,8),
    is_active BOOLEAN,
    cap_reached BOOLEAN DEFAULT FALSE
);

-- Referral tree (materialized path for fast 15-level queries)
CREATE TABLE referral_tree (
    ancestor VARCHAR(42),
    descendant VARCHAR(42),
    depth INTEGER,
    PRIMARY KEY (ancestor, descendant)
);

-- Income ledger (for reporting/history)
CREATE TABLE income_ledger (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42),
    income_type VARCHAR(20), -- DIRECT, TEAM, RANK, etc.
    amount_usd DECIMAL(20,8),
    amount_kairo DECIMAL(20,8),
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);

-- CMS subscriptions
CREATE TABLE cms_subscriptions (
    id SERIAL PRIMARY KEY,
    buyer VARCHAR(42),
    referrer VARCHAR(42),
    amount INTEGER, -- number of subs
    loyalty_reward DECIMAL(20,8),
    leadership_rewards JSONB, -- {level1: x, level2: y...}
    claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
Indexer Service:
TypeScript
Copy
// Event listeners:
// 1. StakingManager: StakeCreated, Compounded, Unstaked, CapReached
// 2. CMS: SubscriptionPurchased, RewardsClaimed
// 3. Affiliate: DirectEarned, TeamEarned, Harvested
// 4. AtomicP2P: OrderCreated, TradeExecuted, OrderCancelled

// Cron Jobs:
// - Every hour: Update rank qualifications (check 50% leg rule)
// - Every 8 hours: Trigger compounding calculations for Tier 1 users
// - Every 6 hours: Tier 2
// - Every 4 hours: Tier 3
// - Weekly: Calculate qualifier bonuses (Monday 00:00 UTC)
// - Monthly: Calculate monthly qualifier bonuses (1st of month)
API Endpoints:
TypeScript
Copy
GET /api/v1/user/:address/dashboard
// Returns: Active stakes, available incomes, team stats, CMS status

GET /api/v1/user/:address/referrals
// Returns: 15-level downline tree with volumes

POST /api/v1/calculate-rank
// Trigger rank calculation for specific user

GET /api/v1/global/stats
// Total TVL, total burned, current price, active stakes count

GET /api/v1/AtomicP2P/orderbook
// Returns: Active buy/sell orders with pagination
3. FRONTEND APPLICATION (Next.js 14 + RainbowKit)
Tech Stack:
Framework: Next.js 14 (App Router)
Styling: TailwindCSS + Framer Motion (animations)
Web3: RainbowKit + wagmi + viem
Charts: Recharts or TradingView Lightweight Charts
State: Zustand (global state) + TanStack Query (server state)
Pages & Components:
A. Public Pages:
Landing: CMS countdown timer, tokenomics visualization, roadmap
AtomicP2P Exchange: Order book interface, price chart (from LP data), create order modal
B. Dashboard (Connected Wallet Required):
Overview Cards:
Total Staked Value (with tier indicator)
Available to Harvest (broken down by type: Direct/Team/Rank)
3X Cap Progress Bar (visual indicator of earnings vs cap)
CMS Rewards Status (if unclaimed with "Use It or Lose It" warning)
Staking Module:
Stake creation form (input amount, auto-detect tier)
Active Stakes Table (showing next compound time, current value, earnings)
Unstake button with 20% penalty warning modal
Auto-compound toggle (if gasless via relayer)
Referral System:
Referral link generator (with copy button)
5-Level tree visualization (collapsible nodes)
Team volume statistics (with leg balancing indicator for 50% rule)
CMS Section:
Subscription purchase form (multi-buy input)
Claim button (disabled if no active stake, shows max claimable vs available)
Warning banner: "Claiming now will wipe X KAIRO permanently"
AtomicP2P Trading:
Order book (buy/sell split view)
My Orders tab (with cancel option)
Trade execution interface (matching orders)
C. Admin Panel (Whitelist only):
System parameters adjustment
Emergency pause functionality
CMS deadline extension (if needed)
View system fee treasury
Critical UI/UX Requirements:
Real-time Updates: Use WebSocket for stake compounding events
Price Oracles: Display live KAIRO price from LP contract
Gas Optimization: Show estimated gas for each transaction on opBNB (should be <$0.01)
Mobile Responsive: Critical for target demographics
Error Handling: Clear messages for "Cap Reached", "Insufficient Stake for Claim", "Min Harvest $10"
4. HOSTINGER VPS DEPLOYMENT ARCHITECTURE
Server Specs Recommendation:
Plan: VPS 4 (4 vCPU, 8GB RAM, 160GB NVMe) - $12.99/month
OS: Ubuntu 22.04 LTS
Location: Singapore or Frankfurt (closest to your user base)
Infrastructure Setup:
A. Security Hardening:
bash
Copy
# Initial setup script
sudo apt update && sudo apt upgrade -y
sudo apt install fail2ban ufw -y

# Firewall rules
sudo ufw default deny incoming
sudo ufw allow 22/tcp   # SSH (change to custom port)
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 8545/tcp # Blockchain RPC (restrict to specific IPs)
sudo ufw enable

# SSH hardening (in /etc/ssh/sshd_config)
Port 2222
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
B. Docker Compose Stack:
yaml
Copy
# /opt/kairo/docker-compose.yml
version: '3.8'

services:
  postgres:
    image: timescale/timescaledb:latest-pg14
    environment:
      POSTGRES_USER: kairo_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: kairo_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - kairo_network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - kairo_network

  backend:
    build: ./backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://kairo_admin:${DB_PASSWORD}@postgres:5432/kairo_prod
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
      - RPC_URL=${OPBNB_RPC}
      - PRIVATE_KEY=${INDEXER_KEY} # For automated compound triggers
    depends_on:
      - postgres
      - redis
    networks:
      - kairo_network
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_BACKEND_URL=https://api.kairo.app
      - NEXT_PUBLIC_CONTRACT_CMS=${CMS_CONTRACT}
      - NEXT_PUBLIC_CONTRACT_STAKING=${STAKING_CONTRACT}
      # ... other contract addresses
    networks:
      - kairo_network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    networks:
      - kairo_network

volumes:
  postgres_data:
  redis_data:

networks:
  kairo_network:
    driver: bridge
C. Nginx Configuration (Reverse Proxy + SSL):
nginx
Copy
# /etc/nginx/sites-available/kairo.app
server {
    listen 443 ssl http2;
    server_name kairo.app www.kairo.app;

    ssl_certificate /etc/letsencrypt/live/kairo.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kairo.app/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Rate limiting
        limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
        limit_req zone=api burst=20 nodelay;
    }

    # WebSocket for real-time updates
    location /ws/ {
        proxy_pass http://localhost:4000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name kairo.app www.kairo.app;
    return 301 https://$server_name$request_uri;
}
D. SSL Certificate (Let's Encrypt):
bash
Copy
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d kairo.app -d www.kairo.app
E. Monitoring & Logging:
PM2: Process management for Node.js apps
Prometheus + Grafana: Metrics dashboard (container stats, API latency, error rates)
Loki: Centralized logging
Uptime Kuma: External monitoring ( alerts to Telegram/Discord)
5. SMART CONTRACT SECURITY REQUIREMENTS
Mandatory Audits:
Reentrancy Protection: Use OpenZeppelin's ReentrancyGuard on all external functions handling transfers
Access Control: Role-based access (OpenZeppelin AccessControl) for minting/burning
Pausability: Emergency pause functionality on all contracts (except Token)
Overflow Protection: Use Solidity 0.8.x built-in checks + SafeMath for clarity
Price Manipulation: Time-weighted average price (TWAP) in LP to prevent flash loan attacks on 3X cap calculations
Specific Risk Mitigations:
3X Cap Oracle Attack: Calculate earnings based on time-weighted stake value, not instantaneous
Referral Cycle: Prevent self-referral and circular referral chains (check ancestor !== descendant)
CMS Deadline: Use block.timestamp with 1-hour buffer for chain variance
Gas Limits: Team dividend distribution capped at 15 levels to prevent gas exhaustion
6. TESTING STRATEGY
Unit Tests (Hardhat):
100% coverage on StakingManager (compound math, cap logic)
Fuzz testing on referral distribution (random trees up to 1000 users)
Edge cases: Exact 3X cap boundary, partial unstake calculations
Integration Tests:
Full user journey: Subscribe → Stake → Compound → Harvest → Unstake
AtomicP2P trade matching with partial fills
CMS claim with various stake amounts (capping logic)
Fork Tests (opBNB mainnet fork):
Test with real USDT contract addresses
Gas optimization verification (target: < 200k gas per compound)
7. DEPLOYMENT CHECKLIST
Pre-Launch:
[ ] Deploy contracts to opBNB Testnet
[ ] Run 7-day simulation with 100 test wallets
[ ] Verify contracts on opBNB Explorer
[ ] Set up multisig for admin roles (Gnosis Safe)
[ ] Deposit initial 10,000 KAIRO + USDT to LP contract
[ ] Set CMS deadline timestamp correctly
Launch Sequence:
Deploy Token → LP → CMS → Staking → Affiliate → AtomicP2P
Link contract addresses in all contracts
Grant MINTER_ROLE to Staking & Affiliate contracts
Grant BURNER_ROLE to LP contract
Lock 10,000 KAIRO in LP (social lock)
Start CMS period
Deploy frontend to Hostinger VPS
Enable Cloudflare (DDOS protection)
DELIVERABLES EXPECTED
Smart Contracts: 6 .sol files with full NatSpec documentation
Backend: TypeScript Node.js API with Docker configuration
Frontend: Next.js 14 app with Web3 integration
Deployment Scripts: Hardhat deployment + Hostinger VPS setup scripts
Documentation: Technical architecture diagram, API docs, User guide
Testing Suite: Hardhat test suite with >90% coverage
Timeline Estimate: 8-10 weeks (2 weeks design, 4 weeks backend/contracts, 2 weeks frontend, 2 weeks testing/audit prep)
CRITICAL NOTES FOR DEVELOPERS:
The 3X Capping mechanism is the most complex part—ensure all income types (vesting + direct + team) aggregate correctly before enforcing the cap
CMS one-time claim with permanent deletion of excess must be clearly warned in UI
opBNB specific: Use 0.1 gwei gas price, verify block time is ~3 seconds for compounding schedules
Compliance: This is a financial product with MLM characteristics—consult legal counsel regarding securities laws and registration requirements in your jurisdiction before deployment