import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

// ============ Redis Connection for BullMQ ============

let redisConnection: IORedis | null = null;

function getRedisConnection(): IORedis {
    if (!redisConnection) {
        redisConnection = new IORedis(config.redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });
        redisConnection.on('error', (err) => {
            console.error('Redis connection error:', err);
        });
        redisConnection.on('connect', () => {
            console.log('Redis connected for BullMQ');
        });
    }
    return redisConnection;
}

// ============ Queue Definitions ============

/**
 * Compounding queue - triggers compound for stakes based on tier intervals
 * Tier 0: every 8 hours, Tier 1: every 6 hours, Tier 2: every 4 hours
 */
export const compoundingQueue = new Queue('compounding', {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
    },
});

/**
 * Rank update queue - recalculates rank qualifications
 * Runs every hour to check team volumes and 50% leg rule
 */
export const rankUpdateQueue = new Queue('rank-update', {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
    },
});

/**
 * Qualifier weekly queue - calculates 3% global weekly profits share
 * Runs every Monday at 00:00 UTC
 */
export const qualifierWeeklyQueue = new Queue('qualifier-weekly', {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 52 },
        removeOnFail: { count: 100 },
    },
});

/**
 * Qualifier monthly queue - calculates 2% global monthly profits share
 * Runs on the 1st of each month
 */
export const qualifierMonthlyQueue = new Queue('qualifier-monthly', {
    connection: getRedisConnection(),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 12 },
        removeOnFail: { count: 50 },
    },
});

/**
 * Initialize recurring jobs (cron-style schedules)
 * Called once at startup
 */
export async function initQueues(): Promise<void> {
    console.log('Initializing BullMQ queues...');

    // Compound Tier 0 every 8 hours
    await compoundingQueue.upsertJobScheduler(
        'compound-tier-0',
        { every: 8 * 60 * 60 * 1000 },
        { data: { tier: 0 }, name: 'compound-tier-0' }
    );

    // Compound Tier 1 every 6 hours
    await compoundingQueue.upsertJobScheduler(
        'compound-tier-1',
        { every: 6 * 60 * 60 * 1000 },
        { data: { tier: 1 }, name: 'compound-tier-1' }
    );

    // Compound Tier 2 every 4 hours
    await compoundingQueue.upsertJobScheduler(
        'compound-tier-2',
        { every: 4 * 60 * 60 * 1000 },
        { data: { tier: 2 }, name: 'compound-tier-2' }
    );

    // TESTING: shortened from every 1 hour to every 3 hours (matches weekly cycle for testing)
    await rankUpdateQueue.upsertJobScheduler(
        'hourly-rank-update',
        { every: 3 * 60 * 60 * 1000 }, // TESTING: shortened from 1 hour
        { data: {}, name: 'hourly-rank-update' }
    );

    // TESTING: shortened from weekly (Monday 00:00 UTC) to every 3 hours
    await qualifierWeeklyQueue.upsertJobScheduler(
        'weekly-qualifier',
        { every: 3 * 60 * 60 * 1000 }, // TESTING: shortened from cron '0 0 * * 1' (weekly)
        { data: {}, name: 'weekly-qualifier' }
    );

    // TESTING: shortened from monthly (1st of month) to every 5 hours
    await qualifierMonthlyQueue.upsertJobScheduler(
        'monthly-qualifier',
        { every: 5 * 60 * 60 * 1000 }, // TESTING: shortened from cron '0 0 1 * *' (monthly)
        { data: {}, name: 'monthly-qualifier' }
    );

    console.log('BullMQ queues initialized with scheduled jobs.');
}

/**
 * Gracefully close all queue connections
 */
export async function closeQueues(): Promise<void> {
    await compoundingQueue.close();
    await rankUpdateQueue.close();
    await qualifierWeeklyQueue.close();
    await qualifierMonthlyQueue.close();
    if (redisConnection) {
        redisConnection.disconnect();
    }
}
