import IORedis from 'ioredis';
import { config } from '../config';
import { query } from '../db/connection';
import { getTeamVolume, getAllLegVolumes } from '../utils/referral-tree';

// ============ Redis Connection ============

let redisConnection: IORedis | null = null;

function getRedisConnection(): IORedis {
    if (!redisConnection) {
        redisConnection = new IORedis(config.redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });
    }
    return redisConnection;
}

// ============ Distributed Lock & Timestamp Helpers ============

async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const redis = getRedisConnection();
    const result = await redis.set(`lock:${key}`, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
}

async function releaseLock(key: string): Promise<void> {
    const redis = getRedisConnection();
    await redis.del(`lock:${key}`);
}

async function getLastRun(key: string): Promise<number> {
    const redis = getRedisConnection();
    return parseInt(await redis.get(key) || '0');
}

async function setLastRun(key: string, timestamp: number): Promise<void> {
    const redis = getRedisConnection();
    await redis.set(key, timestamp.toString());
}

// ============ Closing Interval Constants (TESTING) ============

const RANK_INTERVAL_SECS = 1 * 3600;     // TESTING: 1 hour (prod: 7 days)

// ============ Rank Thresholds & Salaries (mirrors AffiliateDistributor.sol) ============

const RANK_THRESHOLDS = [
    10_000, 30_000, 100_000, 300_000, 1_000_000,
    3_000_000, 10_000_000, 30_000_000, 100_000_000, 250_000_000,
];

const RANK_SALARIES = [
    10, 30, 70, 200, 600,
    1_200, 4_000, 12_000, 40_000, 100_000,
];

// ============ DB-Only Rank Update (no on-chain signing) ============

/**
 * Update rank levels in the database based on team volume calculations.
 * This is purely a DB operation — no on-chain transactions are signed.
 * On-chain rank sync happens when users call checkRankChange() from the frontend.
 */
export async function runRankUpdate(): Promise<void> {
    console.log('[Closing] DB-only rank update starting...');

    // Query all users that have team volume (are referrers)
    const usersResult = await query(
        `SELECT DISTINCT u.wallet_address
         FROM users u
         WHERE u.wallet_address IN (
             SELECT ancestor FROM referral_tree WHERE depth > 0
         )`
    );

    console.log(`[Closing] Processing ${usersResult.rows.length} users for rank update`);

    let updatedCount = 0;

    for (const row of usersResult.rows) {
        try {
            const userAddr = row.wallet_address;

            // Calculate team volume from DB (excludes user's own personal volume)
            const teamVolumeStr = await getTeamVolume(userAddr);
            const teamVolume = parseFloat(teamVolumeStr);

            if (teamVolume <= 0) continue;

            // Get ALL leg volumes (each leg = direct referral's own stake + their downline)
            const legVolumes = await getAllLegVolumes(userAddr);

            // Apply 50%-of-rank-target rule:
            // For each rank, cap each leg at 50% of that rank's threshold.
            // Only qualify if the sum of capped legs meets the threshold.
            let rankLevel = 0;
            for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
                const threshold = RANK_THRESHOLDS[i];
                const maxPerLeg = threshold / 2; // 50% of THIS rank's target

                let qualifyingVol = 0;
                for (const legVol of legVolumes) {
                    qualifyingVol += Math.min(legVol, maxPerLeg);
                }

                if (qualifyingVol >= threshold) {
                    rankLevel = i + 1;
                    break;
                }
            }

            // Update rank in DB only (no on-chain call)
            await query(
                `UPDATE users SET rank_level = $1, team_volume = $2, updated_at = NOW()
                 WHERE wallet_address = $3`,
                [rankLevel, teamVolumeStr, userAddr]
            );

            if (rankLevel > 0) {
                updatedCount++;
                console.log(`[Closing] DB rank updated for ${userAddr}: level=${rankLevel}`);
            }
        } catch (err: any) {
            console.error(`[Closing] Error processing user ${row.wallet_address}:`, err.message || err);
        }
    }

    console.log(`[Closing] DB rank update complete: ${updatedCount} users updated`);
}

// ============ Event-Triggered Closing Check ============

/**
 * Check if any closing period has elapsed and trigger DB-only rank update.
 * Called from the indexer after any user event (stake, unstake, harvest, subscribe).
 * Uses Redis locks to prevent concurrent closings.
 * NOTE: No on-chain transactions are signed. Users trigger on-chain rank sync
 * by calling checkRankChange() from the frontend (user pays gas).
 */
export async function checkAndTriggerClosings(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // Check rank update
    const lastRank = await getLastRun('closing:rank:lastRun');
    if (now - lastRank >= RANK_INTERVAL_SECS) {
        if (await acquireLock('rank-closing', 120)) {
            try {
                // Re-check after acquiring lock (another process may have completed it)
                const freshLastRank = await getLastRun('closing:rank:lastRun');
                if (now - freshLastRank >= RANK_INTERVAL_SECS) {
                    await runRankUpdate();
                    await setLastRun('closing:rank:lastRun', Math.floor(Date.now() / 1000));
                }
            } catch (err) {
                console.error('[Closing] Event-triggered rank update failed:', err);
            } finally {
                await releaseLock('rank-closing');
            }
        }
    }
}

// ============ Worker Lifecycle (no-op — workers removed) ============

/**
 * Start workers (no-op: all on-chain workers removed).
 * Compounding and rank sync are now user-initiated from the frontend.
 */
export async function startWorkers(): Promise<void> {
    console.log('[Workers] No backend workers needed — compounding and rank sync are user-initiated.');
}

/**
 * Gracefully close workers (no-op)
 */
export async function stopWorkers(): Promise<void> {
    if (redisConnection) {
        redisConnection.disconnect();
        redisConnection = null;
    }
    console.log('[Workers] Cleanup complete.');
}
