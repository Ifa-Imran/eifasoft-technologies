-- Migration: 003_reset_indexer_for_full_reindex.sql
-- Reset indexer_state to force re-indexing from deployment block.
-- The tier 2 stakes (and others) were never indexed because the indexer
-- started too late and missed the StakeCreated events.
-- ON CONFLICT clauses in handlers ensure idempotent re-processing.

TRUNCATE TABLE indexer_state;
