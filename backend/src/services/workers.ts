import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { query } from '../db/connection';
import { getStakingManager, getAffiliateDistributor } from './blockchain';
import { getTeamVolume, getLargestLeg } from '../utils/referral-tree';

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

// ============ Compound Worker ============

function createCompoundWorker(): Worker {
    return new Worker(
        'compounding',
        async (job: Job) => {
            const tier: number = job.data.tier;
            console.log(`[CompoundWorker] Starting compound for tier ${tier}...`);

            try {
                // Query active stakes for this tier that are due for compounding
                // TESTING intervals: Tier0=900s(15m), Tier1=600s(10m), Tier2=300s(5m)
                // PRODUCTION intervals: Tier0=28800s(8h), Tier1=21600s(6h), Tier2=14400s(4h)
                const result = await query(
                    `SELECT s.user_address, s.stake_id_on_chain
                     FROM stakes s
                     WHERE s.is_active = TRUE
                       AND s.tier = $1
                       AND s.cap_reached = FALSE
                       AND s.last_compound < NOW() - INTERVAL '1 second' *
                           CASE
                               WHEN $1 = 0 THEN 900
                               WHEN $1 = 1 THEN 600
                               WHEN $1 = 2 THEN 300
                               ELSE 900
                           END
                     ORDER BY s.last_compound ASC`,
                    [tier]
                );

                console.log(`[CompoundWorker] Found ${result.rows.length} stakes due for tier ${tier}`);

                const stakingManager = getStakingManager(true);
                if (!stakingManager) {
                    console.warn('[CompoundWorker] Contracts not configured, skipping compound');
                    return;
                }
                let successCount = 0;
                let failCount = 0;

                for (const row of result.rows) {
                    try {
                        // Estimate gas first
                        const gasEstimate = await stakingManager.compoundFor.estimateGas(
                            row.user_address,
                            row.stake_id_on_chain
                        );

                        // Execute compound with 20% gas buffer
                        const tx = await stakingManager.compoundFor(
                            row.user_address,
                            row.stake_id_on_chain,
                            { gasLimit: (gasEstimate * BigInt(120)) / BigInt(100) }
                        );

                        await tx.wait();
                        successCount++;
                        console.log(`[CompoundWorker] Compounded: user=${row.user_address}, stakeId=${row.stake_id_on_chain}`);
                    } catch (err: any) {
                        failCount++;
                        console.error(
                            `[CompoundWorker] Failed to compound: user=${row.user_address}, stakeId=${row.stake_id_on_chain}:`,
                            err.message || err
                        );
                    }
                }

                console.log(`[CompoundWorker] Tier ${tier} complete: ${successCount} success, ${failCount} failed`);
            } catch (err) {
                console.error(`[CompoundWorker] Error processing tier ${tier}:`, err);
                throw err;
            }
        },
        {
            connection: getRedisConnection(),
            concurrency: 1,
        }
    );
}

// ============ Rank Update Core Logic ============

export async function runRankUpdate(): Promise<void> {
    console.log('[Closing] Rank update starting...');

    // Query all users that have team_volume > 0 or are referrers
    const usersResult = await query(
        `SELECT DISTINCT u.wallet_address
         FROM users u
         WHERE u.wallet_address IN (
             SELECT ancestor FROM referral_tree WHERE depth > 0
         )`
    );

    console.log(`[Closing] Processing ${usersResult.rows.length} users for rank update`);

    const affiliateDistributor = getAffiliateDistributor(true);
    if (!affiliateDistributor) {
        console.warn('[Closing] Contracts not configured, skipping rank update');
        return;
    }
    let updatedCount = 0;

    for (const row of usersResult.rows) {
        try {
            const userAddr = row.wallet_address;

            // Calculate team volume from DB
            const teamVolumeStr = await getTeamVolume(userAddr);
            const teamVolume = parseFloat(teamVolumeStr);

            if (teamVolume <= 0) continue;

            // Get largest leg
            const { largestLeg: largestLegStr } = await getLargestLeg(userAddr);
            const largestLeg = parseFloat(largestLegStr);

            // Apply 50% max leg rule
            const maxLeg = teamVolume / 2;
            let adjustedVolume: number;
            if (largestLeg > maxLeg) {
                adjustedVolume = teamVolume - largestLeg + maxLeg;
            } else {
                adjustedVolume = teamVolume;
            }

            // Determine rank level based on thresholds (highest qualifying)
            let rankLevel = 0;
            let rankSalary = 0;
            for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
                if (adjustedVolume >= RANK_THRESHOLDS[i]) {
                    rankLevel = i + 1;
                    rankSalary = RANK_SALARIES[i];
                    break;
                }
            }

            // Update rank in DB
            await query(
                `UPDATE users SET rank_level = $1, team_volume = $2, updated_at = NOW()
                 WHERE wallet_address = $3`,
                [rankLevel, teamVolumeStr, userAddr]
            );

            // If user qualifies for rank salary, update on-chain
            if (rankSalary > 0) {
                try {
                    const salaryWei = BigInt(rankSalary) * BigInt(10) ** BigInt(18);
                    const tx = await affiliateDistributor.updateRankDividend(
                        userAddr,
                        salaryWei
                    );
                    await tx.wait();
                    updatedCount++;
                    console.log(`[Closing] Updated rank for ${userAddr}: level=${rankLevel}, salary=${rankSalary}`);
                } catch (err: any) {
                    console.error(`[Closing] On-chain rank update failed for ${userAddr}:`, err.message || err);
                }
            }
        } catch (err: any) {
            console.error(`[Closing] Error processing user ${row.wallet_address}:`, err.message || err);
        }
    }

    console.log(`[Closing] Rank update complete: ${updatedCount} users updated on-chain`);
}

// ============ Rank Calculator Worker ============

function createRankUpdateWorker(): Worker {
    return new Worker(
        'rank-update',
        async (_job: Job) => {
            // Check if already triggered by event within this period
            const lastRank = await getLastRun('closing:rank:lastRun');
            const now = Math.floor(Date.now() / 1000);
            if (now - lastRank < RANK_INTERVAL_SECS) {
                console.log('[Worker] Rank update already triggered by event, skipping');
                return;
            }

            try {
                await runRankUpdate();
                await setLastRun('closing:rank:lastRun', Math.floor(Date.now() / 1000));
            } catch (err) {
                console.error('[RankWorker] Error in rank calculation:', err);
                throw err;
            }
        },
        {
            connection: getRedisConnection(),
            concurrency: 1,
        }
    );
}

// ============ Event-Triggered Closing Check ============

/**
 * Check if any closing period has elapsed and trigger immediately.
 * Called from the indexer after any user event (stake, unstake, harvest, subscribe).
 * Uses Redis locks to prevent concurrent closings.
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

// ============ Worker Lifecycle ============

let workers: Worker[] = [];

/**
 * Start all BullMQ workers
 */
export async function startWorkers(): Promise<void> {
    console.log('Starting BullMQ workers...');

    const compoundWorker = createCompoundWorker();
    const rankUpdateWorker = createRankUpdateWorker();

    workers = [compoundWorker, rankUpdateWorker];

    // Set up error handlers
    for (const worker of workers) {
        worker.on('failed', (job, err) => {
            console.error(`[Worker:${worker.name}] Job ${job?.id} failed:`, err.message);
        });

        worker.on('completed', (job) => {
            console.log(`[Worker:${worker.name}] Job ${job.id} completed`);
        });

        worker.on('error', (err) => {
            console.error(`[Worker:${worker.name}] Worker error:`, err);
        });
    }

    console.log('BullMQ workers started: compounding, rank-update');
}

/**
 * Gracefully close all workers
 */
export async function stopWorkers(): Promise<void> {
    console.log('Stopping BullMQ workers...');
    await Promise.all(workers.map((w) => w.close()));
    if (redisConnection) {
        redisConnection.disconnect();
    }
    console.log('BullMQ workers stopped.');
}
