-- Migration: 002_add_unique_constraints.sql
-- Add unique constraints for idempotent event processing (polling + WS dedup)

-- Prevent duplicate stakes from being indexed twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_stakes_user_chain_id
    ON stakes(user_address, stake_id_on_chain);

-- Prevent duplicate income ledger entries from the same tx
CREATE UNIQUE INDEX IF NOT EXISTS idx_income_ledger_dedup
    ON income_ledger(user_address, income_type, tx_hash);
