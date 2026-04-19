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

    // Rank salary update every 1 hour (TESTING) — production: 7 days
    await rankUpdateQueue.upsertJobScheduler(
        'hourly-rank-update',
        { every: 1 * 60 * 60 * 1000 }, // TESTING: 1 hour (prod: 7 days)
        { data: {}, name: 'hourly-rank-update' }
    );

    console.log('BullMQ queues initialized with scheduled jobs.');
}

/**
 * Gracefully close all queue connections
 */
export async function closeQueues(): Promise<void> {
    await compoundingQueue.close();
    await rankUpdateQueue.close();
    if (redisConnection) {
        redisConnection.disconnect();
    }
}
