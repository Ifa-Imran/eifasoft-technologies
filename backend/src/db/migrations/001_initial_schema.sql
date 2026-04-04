-- KAIRO DeFi Ecosystem - Initial Database Schema
-- Migration: 001_initial_schema.sql

-- Users table (indexed by wallet address)
CREATE TABLE IF NOT EXISTS users (
    wallet_address VARCHAR(42) PRIMARY KEY,
    referrer VARCHAR(42),
    total_staked_volume DECIMAL(36,18) DEFAULT 0,
    team_volume DECIMAL(36,18) DEFAULT 0,
    rank_level INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Staking positions (synced from StakingManager events)
CREATE TABLE IF NOT EXISTS stakes (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    stake_id_on_chain INTEGER NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    original_amount DECIMAL(36,18) NOT NULL,
    tier INTEGER NOT NULL,
    start_time TIMESTAMP NOT NULL,
    last_compound TIMESTAMP NOT NULL,
    total_earned DECIMAL(36,18) DEFAULT 0,
    harvested_rewards DECIMAL(36,18) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    cap_reached BOOLEAN DEFAULT FALSE,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stakes_user ON stakes(user_address);
CREATE INDEX IF NOT EXISTS idx_stakes_active ON stakes(is_active);

-- Referral tree (materialized path for fast 15-level queries)
CREATE TABLE IF NOT EXISTS referral_tree (
    ancestor VARCHAR(42) NOT NULL,
    descendant VARCHAR(42) NOT NULL,
    depth INTEGER NOT NULL,
    PRIMARY KEY (ancestor, descendant)
);
CREATE INDEX IF NOT EXISTS idx_referral_descendant ON referral_tree(descendant);

-- Income ledger (for reporting/history)
CREATE TABLE IF NOT EXISTS income_ledger (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) NOT NULL,
    income_type VARCHAR(20) NOT NULL,
    amount_usd DECIMAL(36,18) DEFAULT 0,
    amount_kairo DECIMAL(36,18) DEFAULT 0,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_income_user ON income_ledger(user_address);
CREATE INDEX IF NOT EXISTS idx_income_type ON income_ledger(income_type);

-- CMS subscriptions
CREATE TABLE IF NOT EXISTS cms_subscriptions (
    id SERIAL PRIMARY KEY,
    buyer VARCHAR(42) NOT NULL,
    referrer VARCHAR(42),
    amount INTEGER NOT NULL,
    loyalty_reward DECIMAL(36,18) DEFAULT 0,
    leadership_rewards JSONB DEFAULT '{}',
    claimed BOOLEAN DEFAULT FALSE,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cms_buyer ON cms_subscriptions(buyer);

-- P2P Orders
CREATE TABLE IF NOT EXISTS p2p_orders (
    id SERIAL PRIMARY KEY,
    order_id_on_chain INTEGER NOT NULL,
    order_type VARCHAR(4) NOT NULL,
    creator VARCHAR(42) NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    price_per_token DECIMAL(36,18) NOT NULL,
    remaining DECIMAL(36,18) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_p2p_creator ON p2p_orders(creator);
CREATE INDEX IF NOT EXISTS idx_p2p_active ON p2p_orders(is_active);

-- P2P Trades
CREATE TABLE IF NOT EXISTS p2p_trades (
    id SERIAL PRIMARY KEY,
    buy_order_id INTEGER NOT NULL,
    sell_order_id INTEGER NOT NULL,
    buyer VARCHAR(42) NOT NULL,
    seller VARCHAR(42) NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    price DECIMAL(36,18) NOT NULL,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Global stats cache
CREATE TABLE IF NOT EXISTS global_stats (
    key VARCHAR(50) PRIMARY KEY,
    value DECIMAL(36,18) NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexer state (track last indexed block per contract)
CREATE TABLE IF NOT EXISTS indexer_state (
    contract_name VARCHAR(50) PRIMARY KEY,
    last_block BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);
