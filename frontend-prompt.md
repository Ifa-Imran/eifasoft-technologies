KAIRO DAO - Futuristic DeFi Interface Development Prompt
Project Identity & Aesthetic Direction
Name: Kairo DAO
Theme: "Neural Nexus" - Cybernetic DeFi Interface
Vibe: Blade Runner meets Wall Street. Deep space aesthetics with holographic data visualization.
Color Palette:
Primary Background: #050507 (Deep Void Black)
Secondary Background: #0A0A0F (Cosmic Navy)
Accent Primary: #00F0FF (Neon Cyan - Interactions)
Accent Secondary: #7000FF (Plasma Purple - Rewards/Income)
Accent Tertiary: #FF2E63 (Neon Coral - Alerts/3X Cap warnings)
Success: #00FFA3 (Matrix Green)
Warning: #FFB800 (Solar Amber)
Glassmorphism: rgba(10, 10, 15, 0.7) with backdrop-filter: blur(20px)
Typography:
Headers: "Orbitron" or "Space Grotesk" (Geometric, futuristic)
Body: "Inter" or "SF Pro Display" (Clean, readable)
Numbers: "JetBrains Mono" or "Roboto Mono" (Tabular figures for financial data)
Technical Stack Requirements
TypeScript
Copy
// Core Framework
- Next.js 14 (App Router)
- TypeScript (Strict mode)
- Tailwind CSS (Custom design system)

// Web3 Integration  
- RainbowKit (Custom themed) + wagmi + viem
- Wallet Support: MetaMask, WalletConnect, Coinbase, Trust Wallet, TokenPocket, OKX Wallet
- Chain: opBNB (Chain ID: 204) + opBNB Testnet

// State & Data
- Zustand (Global state)
- TanStack Query (Server state caching)
- WebSocket connection for real-time stake updates

// Animation & 3D
- Framer Motion (Page transitions, micro-interactions)
- Three.js / React Three Fiber (Background neural network visualization)
- GSAP (ScrollTrigger for landing page)

// Charts & Visualization
- TradingView Lightweight Charts (P2P price history)
- Recharts (Staking analytics, team volume)

// UI Components
- Radix UI primitives (Accessibility first)
- Custom glassmorphic components
Global Design System Specifications
1. Glassmorphic Card Component
TypeScript
Copy
// All content containers must use:
- Background: rgba(10, 10, 15, 0.6)
- Backdrop-filter: blur(20px) saturate(180%)
- Border: 1px solid rgba(255, 255, 255, 0.08)
- Box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37)
- Border-radius: 16px (mobile: 12px)
- Hover state: Border glows with accent color, subtle lift transform
2. Neon Button Variants
Primary: Cyan gradient background (#00F0FF to #0080FF), black text, glow effect on hover
Secondary: Transparent with cyan border, cyan text, fill animation on hover
Warning (3X Cap): Pulsing coral gradient (#FF2E63 to #FF6B6B), urgent micro-animations
Disabled: Grayed out with "LOCKED" holographic overlay
3. Data Visualization Style
All numbers use mono-spaced fonts
Large figures (TVL, Prices) have animated counting on load
Percentage changes use arrow indicators with color coding
"Live" indicators use pulsing cyan dots
4. Background Effects
Primary: Dark gradient mesh with subtle floating particles
Dashboard: Interactive neural network visualization (Three.js) showing connected nodes representing team referrals
Mobile: Simplified gradient to preserve battery
Page Architecture & Features
PAGE 1: LANDING PAGE (/)
Hero Section:
Headline: "The Future of Deflationary Wealth" (Kinetic typography animation)
Subheadline: "3X Capped Staking • Neural Referral Networks • Atomic P2P Exchange"
CMS Countdown Timer:
Large holographic display showing time remaining until deadline (May 1, 2026)
Progress bar showing subscription fill (10,000 max)
Live counter: "X,XXX Subscriptions Remaining"
Critical UI: Warning badge if deadline approaching (< 7 days)
Live Metrics Ticker:
Floating glass bar showing: KAIRO Price | Total Value Locked | Total Burned | Active Stakes
Updates every 30 seconds with smooth number transitions
Feature Grid (3 Cards):
"The 3X Protocol" - Explain hard cap mechanism with animated diagram
"Neural Networks" - 5-level referral visualization
"Atomic Exchange" - Zero-slippage P2P trading preview
CTA Section:
"Enter The DAO" button with wallet connection modal
Footer with contract addresses (click to copy) and security badges
PAGE 2: DASHBOARD (/dashboard)
Layout: Sidebar navigation (collapsible on mobile) + Main content grid
Header Stats Cards (4-column grid, stack on mobile):
Portfolio Value: USD equivalent of all stakes + rewards (large cyan numbers)
Active Stakes: Count + Next compound timer (countdown)
3X Cap Status: Visual circular progress bar showing proximity to 3X cap (coral warning when >80%)
Claimable Rewards: Breakdown by type (Direct/Team/Rank/Qualifier)
Main Sections:
A. Staking Control Center
Tier Selection Visualizer:
3 horizontal cards showing Tier 1 (8h), Tier 2 (6h), Tier 3 (4h)
Auto-highlight based on input amount
"Current APY" display (dynamic based on compound frequency)
Active Stakes Table:
Columns: Stake ID | Amount | Tier | Current Value | Next Compound | 3X Progress | Actions
3X Progress Column: Mini progress bar with color coding (Green <50%, Yellow 50-80%, Red >90%)
Actions: Compound (manual), Harvest, Unstake (with 20% penalty warning modal)
Compound Animation: When triggered, show particle explosion effect with "+X.XX USDT" floating text
B. Affiliate Neural Network
Referral Link Generator: Copy button with "copied" confirmation
5-Level Tree Visualization:
Interactive collapsible tree diagram
Each node shows: Address (truncated) | Volume | Direct Count
Color-coded by activity level
Mobile: Vertical accordion list instead of tree
Income Breakdown Cards:
Direct Dividends (5%)
Team Dividends (L1: 10%, L2-10: 5%, L11-15: 2%)
Rank Salary (Weekly)
Qualifier Bonuses (Weekly/Monthly)
Harvest Button: Per category, disabled if < $10, shows USD → KAIRO conversion preview
C. CMS Status Widget
Subscription count owned
Loyalty rewards (5 KAIRO per sub)
Leadership rewards (accumulated)
CRITICAL UI ELEMENT: "Claim Status"
Green: Ready to claim (active stake detected)
Red: "NO ACTIVE STAKE - CLAIM WILL BE FORFEITED"
Warning modal: "You are about to permanently lose X KAIRO due to insufficient stake"
PAGE 3: STAKING INTERFACE (/stake)
Step-by-Step Flow:
Step 1: Amount Input
Large numeric input with USDT suffix
Slider for quick selection (10 - 10,000 USDT)
Tier Auto-Detection: Visual highlight of which tier the amount qualifies for
Info tooltip: "Higher tiers compound faster (more daily closings)"
Step 2: Referrer Input
Optional field with validation
"Check" button to verify referrer exists
Warning: "No self-referral allowed"
Step 3: Confirmation Modal
Summary: Amount | Tier | Compound Interval | Estimated 3X Date
Risk Disclosure: Checkbox required: "I understand that unstaking before 3X cap returns only 80% of value"
Gas estimation display (opBNB: ~$0.01)
Post-Stake Animation:
Success screen with "Stake Activated" holographic badge
Auto-redirect to dashboard after 3 seconds
PAGE 4: ATOMIC P2P EXCHANGE (/exchange)
Layout: Split-screen (Order Book Left, Chart Right) - Stacks on mobile
Price Chart (Top):
TradingView Lightweight Chart
KAIRO/USDT pair
Timeframes: 1H, 4H, 1D, 1W
Volume bars at bottom
Order Book Interface:
Create Order Panel:
Tabs: Buy KAIRO | Sell KAIRO
Buy Form: USDT Amount input → Calculates KAIRO received at live price
Sell Form: KAIRO Amount input → Calculates USDT received
Price Display: "Current Oracle Price: $X.XXXX"
Fee Display: "Network Fee: 2% (1% Burn, 1% LP)"
Note: One-way swap warning if trying to buy KAIRO directly (redirect to P2P)
Order Book List:
Buy Orders: Green gradient rows (Price | Available | Total | Action)
Sell Orders: Red gradient rows
Matching Interface: Click order to auto-fill trade form
Partial Fill Support: Show "Fill X%" slider
My Orders Section:
Active orders with cancel button
Trade history with status badges
PAGE 5: RANK & QUALIFIERS (/rank)
Rank Progress Visualization:
10-level pyramid diagram (Starlight → Nova → Galaxy → Universe tiers)
Current rank highlighted with neon glow
Progress to next rank: "XXX USDT Volume Needed"
50% Leg Rule Visualization: Pie chart showing team volume distribution by leg
Qualifier Status:
Weekly qualifier progress bar (3% pool share)
Monthly qualifier progress bar (2% pool share)
Countdown to next distribution
Critical UI/UX Requirements
Mobile Responsiveness
Breakpoint Strategy:
Desktop: 1440px+ (Full sidebar, multi-column grids)
Tablet: 768px-1439px (Collapsed sidebar, 2-column grids)
Mobile: <768px (Bottom navigation bar, single column, swipeable tabs)
Touch Targets: Minimum 48px for all buttons
Wallet Connection: Deep linking for mobile wallets (MetaMask app, Trust Wallet)
Wallet Integration Deep Dive
TypeScript
Copy
// Required Wallet Support:
- Injected (MetaMask, Trust Wallet)
- WalletConnect v2 (Support ALL wallets via QR + mobile deep link)
- Coinbase Wallet
- TokenPocket
- OKX Wallet
- Safe (Gnosis) for multisig users

// Connection UI:
- RainbowKit custom theme matching Kairo DAO colors
- "Connecting" state with animated loading
- Network auto-switch to opBNB (prompt user if wrong network)
- Display connected wallet icon + truncated address in header
Real-Time Features
WebSocket Connections:
Stake compounding events (live notification when compound happens)
New P2P orders
Price updates from LiquidityPool
Toast Notifications:
Transaction pending (cyan, spinning)
Transaction success (green, checkmark)
Transaction failed (red, error details)
3X Cap reached (urgent coral alert with sound effect)
Critical Warning Modals
3X Cap Approaching: When user reaches 90% of 3X cap, show persistent banner: "Cap imminent. Compound or unstake to secure rewards."
CMS Forfeiture Warning: Before claim, force 2-step confirmation if excess will be burned
Unstake Penalty: Clear breakdown: "You will receive 80% minus harvested rewards. X USDT will be forfeited."
Loading States & Skeletons
All data-fetching components use shimmer skeletons matching the glassmorphic style
Transaction buttons show "Confirm in Wallet..." → "Processing..." → "Confirmed" states
Never show empty states; use "Connect Wallet" placeholders or "-"
Smart Contract Interaction Mapping
Contract Addresses (Environment Variables)
env
Copy
NEXT_PUBLIC_KAIRO_TOKEN=0x...
NEXT_PUBLIC_CMS=0x...
NEXT_PUBLIC_STAKING_MANAGER=0x...
NEXT_PUBLIC_AFFILIATE_DISTRIBUTOR=0x...
NEXT_PUBLIC_LIQUIDITY_POOL=0x...
NEXT_PUBLIC_ATOMIC_P2P=0x...
NEXT_PUBLIC_USDT=0x...
Key Function Implementations
Staking Flow:
TypeScript
Copy
// Approve USDT → Stake → Update UI optimistically
// Handle events: StakeCreated, Compounded, CapReached
// Calculate 3X progress: (totalEarned / (originalAmount * 3)) * 100
CMS Claim Flow:
TypeScript
Copy
// Check: stakingManager.getTotalActiveStakeValue(user) > 0
// Calculate max claimable: (stakeValue * 1e18) / livePrice
// If rewards > max → Show "Burn Warning" with exact amount to be lost
// Execute claim → Clear loyalty/leadership balances
Harvest Flow:
TypeScript
Copy
// Check minimum $10 per type
// Show preview: "Harvest X USD = Y KAIRO at current price"
// Batch harvest option (harvest all types in one tx if possible)
Performance & Security Requirements
Optimization
Image Optimization: WebP format, lazy loading
Code Splitting: Dynamic imports for heavy components (Three.js, Charts)
RPC Fallbacks: Primary (opBNB official) → Backup (Ankr/NodeReal) → Local
Caching: TanStack Query with 30s stale time for blockchain data
Security UI Patterns
Transaction Preview: Always show exact token amounts before signing
Contract Verification: Badge showing "Verified Contract" with link to explorer
Slippage Protection: User-configurable (0.5%, 1%, 2%) with warning if high
Approval Limits: Use exact approvals instead of unlimited (UI toggle for "Use exact amount")
Accessibility Requirements
WCAG 2.1 AA compliance
Keyboard navigation support (Tab through all interactive elements)
Screen reader labels for all crypto-specific terms ("3X Cap" explained as "Triple your stake limit")
Color contrast ratio minimum 4.5:1 (adjust neon colors with dark backgrounds)
Reduced motion option (disable Three.js and heavy animations if user prefers)
Deliverables Checklist
[ ] Next.js 14 project setup with TypeScript
[ ] Complete component library (Storybook preferred)
[ ] All 5 pages with full functionality
[ ] RainbowKit integration with 8+ wallets
[ ] Mobile-responsive layouts (tested on iOS Safari + Android Chrome)
[ ] Real-time WebSocket connections for stake updates
[ ] Three.js background animation (desktop only)
[ ] Complete interaction with all 6 smart contracts
[ ] Error handling for all transaction failures
[ ] Loading states and optimistic updates
[ ] SEO optimization (meta tags, Open Graph images)
Final Instruction for AI Agent:
Build this as if it's going to handle $10M+ in TVL on day one. Every button click must feel satisfying, every number must update in real-time, and every warning must be impossible to ignore. The 3X cap mechanism and CMS forfeiture warnings are legally critical—make them unmistakably clear. Make opBNB feel like a premium chain, not a secondary network.