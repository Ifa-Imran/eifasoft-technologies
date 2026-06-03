-- KAIRO DeFi Ecosystem - Admin Panel Schema
-- Migration: 002_admin_panel.sql

-- Admin users (password-based login)
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Rank change history (populated when calculate-rank detects a change)
CREATE TABLE IF NOT EXISTS rank_history (
    id SERIAL PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    previous_rank INTEGER NOT NULL,
    new_rank INTEGER NOT NULL,
    team_volume DECIMAL(36,18) DEFAULT 0,
    direct_count INTEGER DEFAULT 0,
    changed_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rank_history_wallet ON rank_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_rank_history_date ON rank_history(changed_at);

-- Disbursement ledger (marks volumes as paid, prevents duplicates)
CREATE TABLE IF NOT EXISTS disbursements (
    id SERIAL PRIMARY KEY,
    target_wallet VARCHAR(42) NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    note TEXT,
    admin_username VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_disbursements_wallet ON disbursements(target_wallet);

-- Upline disbursement rollup entries (auto-generated when a disbursement is created)
CREATE TABLE IF NOT EXISTS disbursement_rollups (
    id SERIAL PRIMARY KEY,
    disbursement_id INTEGER NOT NULL REFERENCES disbursements(id),
    wallet_address VARCHAR(42) NOT NULL,
    depth INTEGER NOT NULL,
    amount DECIMAL(36,18) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rollup_wallet ON disbursement_rollups(wallet_address);
CREATE INDEX IF NOT EXISTS idx_rollup_disbursement ON disbursement_rollups(disbursement_id);
